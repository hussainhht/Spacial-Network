// Resolve dependencies alongside the installed CLI, including local-prefix installs.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const req = createRequire(fs.realpathSync(process.env.EARTH_GLTF_CLI));
let sharp, validator;
try {
  sharp = req('sharp');
  validator = req('gltf-validator');
} catch (error) {
  console.error('Missing verification dependency. Install sharp and gltf-validator alongside @gltf-transform/cli.');
  process.exit(1);
}
if (process.argv[2] === '--dependencies') process.exit(0);
function read(path) {
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942);
  return { bytes, json, bin: bytes.subarray(28 + length) };
}
function image(model, index) {
  const im = model.json.images[index];
  const view = model.json.bufferViews[im.bufferView];
  assert.ok(view && !im.uri, 'Expected embedded image');
  const offset = view.byteOffset || 0;
  assert.ok(offset + view.byteLength <= model.bin.length);
  return model.bin.subarray(offset, offset + view.byteLength);
}
function slots(value, path = '', result = {}) {
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== 'object') continue;
    if (key.endsWith('Texture')) result[path + key] = child;
    else slots(child, path + key + '.', result);
  }
  return result;
}
function hierarchy(d) {
  const floats = v => v?.map(Math.fround);
  return d.nodes.map(n => ({ name: n.name, children: (n.children || []).map(i => d.nodes[i].name),
    matrix: floats(n.matrix), translation: floats(n.translation), rotation: floats(n.rotation), scale: floats(n.scale) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
async function main() {
  const source = read(process.argv[2]), output = read(process.argv[3]);
  const a = source.json, b = output.json;
  const report = await validator.validateBytes(new Uint8Array(output.bytes), { maxIssues: 1000 });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.deepEqual(hierarchy(b), hierarchy(a), 'Node hierarchy/transforms changed');
  assert.deepEqual(b.scenes.map(s => s.nodes.map(i => b.nodes[i].name)), a.scenes.map(s => s.nodes.map(i => a.nodes[i].name)));
  for (const name of ['surface', 'cloud', 'atmo']) {
    const n = b.nodes.filter(n => n.name === name);
    assert.equal(n.length, 1, `Missing/duplicate node: ${name}`);
    assert.ok(b.meshes[n[0].mesh]?.primitives.length, `Missing mesh: ${name}`);
    const original = a.nodes.find(n => n.name === name);
    const assigned = (d, node) => d.meshes[node.mesh].primitives.map(p => d.materials[p.material].name);
    assert.deepEqual(assigned(b, n[0]), assigned(a, original), `Material assignment changed: ${name}`);
  }
  assert.equal(b.materials.length, a.materials.length);
  for (const mat of a.materials) {
    const out = b.materials.find(m => m.name === mat.name);
    assert.ok(out, `Missing material ${mat.name}`);
    for (const key of ['alphaMode', 'alphaCutoff', 'doubleSided']) assert.deepEqual(out[key], mat[key]);
    const inputSlots = slots(mat), outputSlots = slots(out);
    const withoutTextureIndices = material => JSON.parse(JSON.stringify(material, (key, value) => key === 'index' ? undefined : value));
    assert.deepEqual(withoutTextureIndices(out), withoutTextureIndices(mat), 'Material properties changed');
    assert.deepEqual(Object.keys(outputSlots), Object.keys(inputSlots));
    for (const [slot, ref] of Object.entries(inputSlots)) {
      const next = outputSlots[slot];
      assert.equal(next.texCoord || 0, ref.texCoord || 0);
      const oldImage = a.textures[ref.index].source;
      const newImage = b.textures[next.index].extensions?.EXT_texture_webp?.source ?? b.textures[next.index].source;
      const oldMeta = await sharp(image(source, oldImage)).metadata();
      const newMeta = await sharp(image(output, newImage)).metadata();
      assert.equal(newMeta.format, 'webp');
      assert.ok(newMeta.width <= Math.min(oldMeta.width, 4096));
      assert.ok(newMeta.height <= Math.min(oldMeta.height, 2048));
      assert.ok(Math.abs(newMeta.width / newMeta.height - oldMeta.width / oldMeta.height) < 0.01);
      assert.equal(!!newMeta.hasAlpha, !!oldMeta.hasAlpha, 'Alpha channel changed');
      // Decode every final texture to ensure its payload is valid.
      await sharp(image(output, newImage)).raw().toBuffer();
      console.log(`${mat.name} ${slot}: ${newMeta.width} × ${newMeta.height} WebP`);
    }
  }
  const triangles = d => d.meshes.reduce((sum, m) => sum + m.primitives.reduce((s, p) => s + d.accessors[p.indices].count / 3, 0), 0);
  console.log(`Triangles: ${triangles(a)} → ${triangles(b)}`);
  console.log(`Validator: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings`);
  console.log(JSON.stringify(report.issues.messages));
  console.log(`\nEarth Web Optimization\nOriginal: ${(source.bytes.length / 1e6).toFixed(2)} MB (${source.bytes.length} bytes)\nOptimized: ${(output.bytes.length / 1e6).toFixed(2)} MB (${output.bytes.length} bytes)\nReduction: ${(100 * (1 - output.bytes.length / source.bytes.length)).toFixed(2)}%\nSimplification ratio: 0.08\nPreserved nodes:\n✓ surface\n✓ cloud\n✓ atmo`);
}
main().catch(error => { console.error(error); process.exit(1); });
