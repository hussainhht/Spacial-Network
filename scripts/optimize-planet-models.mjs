#!/usr/bin/env node
// Lossless / visually-lossless web optimization pipeline for planet GLB models.
//
// What this does, per model:
//   dedup  -> merge byte-identical duplicate accessors/materials/textures/meshes
//   prune  -> drop nodes/accessors/textures that no Scene references
//   weld   -> merge bitwise-identical duplicate vertices
//   reorder -> reorder vertex/index buffers for better GPU cache locality / compressibility
//
// None of these steps touch pixel data, resize a texture, change a vertex
// position/normal/UV value, or reduce triangle count. Every step is reversible
// information-theoretically (dedup/prune only remove things nothing points at,
// weld only merges exact duplicates, reorder only permutes). That is why this
// script never needs a before/after visual diff to trust its output — it
// instead asserts the invariants that make "lossless" true, and refuses to
// write a result that doesn't hold.
//
// Usage: node scripts/optimize-planet-models.mjs [modelId ...]
//   With no arguments, processes every model in MODELS below.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const MODELS_DIR = path.join(
  REPO_ROOT,
  "frontend",
  "public",
  "models",
  "planets",
);
const TOOLS_DIR = path.join(REPO_ROOT, "3d", ".tools");
const GLTF_TRANSFORM_BIN = path.join(
  TOOLS_DIR,
  "node_modules",
  ".bin",
  "gltf-transform",
);
const RUN_TMP_DIR = path.join(REPO_ROOT, "3d", ".tmp", `optimize-${process.pid}`);

// Dependencies (gltf-validator, sharp) live alongside gltf-transform in 3d/.tools,
// installed per 3d/README.md. Resolve them from there regardless of cwd.
const toolsRequire = createRequire(path.join(TOOLS_DIR, "package.json"));

function requireTool(name) {
  try {
    return toolsRequire(name);
  } catch {
    console.error(
      `Missing dependency "${name}". Install it with:\n` +
        `  npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp`,
    );
    process.exit(1);
  }
}

const gltfValidator = requireTool("gltf-validator");
const sharp = requireTool("sharp");

if (!fs.existsSync(GLTF_TRANSFORM_BIN)) {
  console.error(`Missing gltf-transform CLI at ${GLTF_TRANSFORM_BIN}`);
  console.error(
    "Install it with: npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp",
  );
  process.exit(1);
}

// source: current filename in frontend/public/models/planets/
// final: required production filename
// alreadyFinal: true when source === final (optimize via temp file, replace in place)
// `preprocess: "metalrough"` is the one deliberate, non-lossless exception in
// this pipeline. jupiter.glb uses the deprecated KHR_materials_pbrSpecularGlossiness
// extension with no pbrMetallicRoughness fallback; this project's Three.js
// (0.185.1) GLTFLoader has no spec/gloss support at all, so loading it as-is
// silently drops the diffuse texture and renders a flat white sphere. Converting
// to metal/rough (KHR_materials_specular + KHR_materials_ior, both natively
// supported) is mathematically-equivalent-appearance and the only way to make
// the file actually render correctly on the web. See docs/3d-model-optimization-report.md.
const MODELS = [
  { id: "black-hole", source: "black-hole-final.glb", final: "black-hole-final.glb", alreadyFinal: true },
  { id: "earth", source: "earth-final.glb", final: "earth-final.glb", alreadyFinal: true },
  { id: "jupiter", source: "jupiter.glb", final: "jupiter-final.glb", alreadyFinal: false, preprocess: "metalrough" },
  { id: "mars", source: "mars-final.glb", final: "mars-final.glb", alreadyFinal: true },
  { id: "mercury", source: "mercury.glb", final: "mercury-final.glb", alreadyFinal: false },
  { id: "moon", source: "moon-final.glb", final: "moon-final.glb", alreadyFinal: true },
  { id: "saturn", source: "saturn-final.glb", final: "saturn-final.glb", alreadyFinal: true },
  { id: "sun", source: "sun.glb", final: "sun-final.glb", alreadyFinal: false },
  { id: "uranus", source: "uranus.glb", final: "uranus-final.glb", alreadyFinal: false },
  { id: "venus", source: "venus.glb", final: "venus-final.glb", alreadyFinal: false },
];

function fmtBytes(n) {
  return `${(n / 1e6).toFixed(2)} MB (${n.toLocaleString()} bytes)`;
}

function run(bin, args) {
  execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
}

// ---- Minimal GLB parser (mirrors 3d/plant/verify-model.cjs) ----
function readGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.ok(bytes.length > 0, `File is empty: ${filePath}`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "Invalid GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "Unsupported GLB version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB length header mismatch");
  const jsonLen = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "Expected JSON chunk");
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString());
  let bin = Buffer.alloc(0);
  const afterJson = 20 + jsonLen;
  if (afterJson < bytes.length) {
    assert.equal(bytes.readUInt32LE(afterJson + 4), 0x004e4942, "Expected BIN chunk");
    bin = bytes.subarray(afterJson + 8);
  }
  return { bytes, json, bin };
}

function imageBytes(model, imageIndex) {
  const im = model.json.images[imageIndex];
  const view = model.json.bufferViews[im.bufferView];
  const offset = view.byteOffset || 0;
  return model.bin.subarray(offset, offset + view.byteLength);
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// A texture's image may live at texture.source, or (when EXT_texture_webp is
// used) at texture.extensions.EXT_texture_webp.source instead.
function resolveImageIndex(doc, textureIndex) {
  const tex = doc.textures[textureIndex];
  return tex.extensions?.EXT_texture_webp?.source ?? tex.source;
}

function triangleCount(d) {
  return (d.meshes || []).reduce(
    (sum, m) =>
      sum +
      (m.primitives || []).reduce((s, p) => {
        if (p.mode !== undefined && p.mode !== 4) return s; // only TRIANGLES
        if (p.indices !== undefined) return s + (d.accessors[p.indices]?.count || 0) / 3;
        if (p.attributes?.POSITION !== undefined) return s + (d.accessors[p.attributes.POSITION]?.count || 0) / 3;
        return s;
      }, 0),
    0,
  );
}

function vertexCount(d) {
  return (d.meshes || []).reduce(
    (sum, m) =>
      sum +
      (m.primitives || []).reduce((s, p) => {
        if (p.attributes?.POSITION !== undefined) return s + (d.accessors[p.attributes.POSITION]?.count || 0);
        return s;
      }, 0),
    0,
  );
}

function textureSlots(material) {
  const slots = {};
  (function walk(obj, p) {
    for (const [k, v] of Object.entries(obj || {})) {
      if (v && typeof v === "object") {
        if (k.endsWith("Texture") && v.index !== undefined) slots[p + k] = v;
        else walk(v, p + k + ".");
      }
    }
  })(material, "");
  return slots;
}

function animationTargetNodeNames(d) {
  return new Set(
    (d.animations || []).flatMap((a) => (a.channels || []).map((c) => d.nodes[c.target.node]?.name)),
  );
}

async function loadWithThree(outputBuffer) {
  const threePaths = [
    path.join(REPO_ROOT, "frontend", "node_modules", "three"),
  ];
  const threePath = threePaths.find((p) => fs.existsSync(p));
  if (!threePath) return { status: "skipped (three not installed)", warnings: [] };
  globalThis.self = globalThis;
  const { GLTFLoader } = await import(
    path.join(threePath, "examples", "jsm", "loaders", "GLTFLoader.js")
  );
  const loader = new GLTFLoader();
  const arrayBuffer = outputBuffer.buffer.slice(
    outputBuffer.byteOffset,
    outputBuffer.byteOffset + outputBuffer.byteLength,
  );
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    await new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, "", resolve, reject);
    });
  } finally {
    console.warn = originalWarn;
  }
  return { status: "ok", warnings };
}

// ---- Core invariant check: does `output` preserve everything `source` renders? ----
async function verifyLossless(sourcePath, outputPath) {
  const source = readGlb(sourcePath);
  const output = readGlb(outputPath);
  const a = source.json;
  const b = output.json;

  const report = await gltfValidator.validateBytes(new Uint8Array(output.bytes), { maxIssues: 1000 });
  assert.equal(
    report.issues.numErrors,
    0,
    `Khronos validator errors: ${JSON.stringify(report.issues.messages)}`,
  );

  for (const ext of b.extensionsRequired || []) {
    assert.ok(
      !["EXT_meshopt_compression", "KHR_draco_mesh_compression"].includes(ext),
      `Output requires an unconfigured runtime decoder: ${ext}`,
    );
  }

  const triA = triangleCount(a);
  const triB = triangleCount(b);
  assert.ok(Math.abs(triA - triB) < 1, `Triangle count changed: ${triA} -> ${triB}`);

  const vertA = vertexCount(a);
  const vertB = vertexCount(b);
  assert.ok(vertB <= vertA, `Vertex count increased: ${vertA} -> ${vertB}`);

  assert.equal((b.materials || []).length, (a.materials || []).length, "Material count changed");

  // Every image byte-blob still referenced by a material in the source must be
  // present, byte-identical, somewhere in the output (dedup may change its index,
  // never its content).
  const outputImageHashes = new Set(
    (b.images || []).map((_, i) => sha256(imageBytes(output, i))),
  );
  for (const mat of a.materials || []) {
    const outMat = (b.materials || []).find((m) => m.name === mat.name);
    assert.ok(outMat, `Missing material: ${mat.name}`);
    const inSlots = textureSlots(mat);
    const outSlots = textureSlots(outMat);
    assert.deepEqual(
      Object.keys(outSlots).sort(),
      Object.keys(inSlots).sort(),
      `Texture slots changed on material ${mat.name}`,
    );
    for (const [slot, ref] of Object.entries(inSlots)) {
      const srcImageIdx = resolveImageIndex(a, ref.index);
      const hash = sha256(imageBytes(source, srcImageIdx));
      assert.ok(
        outputImageHashes.has(hash),
        `Texture bytes for ${mat.name}.${slot} changed (not byte-identical to source)`,
      );
      assert.equal(
        (outSlots[slot].texCoord || 0),
        (ref.texCoord || 0),
        `texCoord changed on ${mat.name}.${slot}`,
      );
    }
  }

  // Animations: same target node names, same keyframe/channel counts (pruning
  // must never touch a node an animation still points at).
  const namesA = animationTargetNodeNames(a);
  const namesB = animationTargetNodeNames(b);
  for (const name of namesA) {
    assert.ok(namesB.has(name), `Animation target node "${name}" lost`);
  }
  const animChannelsA = (a.animations || []).reduce((s, x) => s + x.channels.length, 0);
  const animChannelsB = (b.animations || []).reduce((s, x) => s + x.channels.length, 0);
  assert.equal(animChannelsB, animChannelsA, "Animation channel count changed");

  const { status: threeResult, warnings } = await loadWithThree(output.bytes).catch((err) => {
    throw new Error(`Three.js GLTFLoader failed to parse output: ${err.message}`);
  });
  const unknownExtWarning = warnings.find((w) => w.includes("Unknown extension"));
  assert.ok(
    !unknownExtWarning,
    `Three.js GLTFLoader cannot resolve a required extension: ${unknownExtWarning}`,
  );

  return {
    triangles: { before: Math.round(triA), after: Math.round(triB) },
    vertices: { before: vertA, after: vertB },
    materials: (b.materials || []).length,
    textures: { before: (a.images || []).length, after: (b.images || []).length },
    animations: (b.animations || []).length,
    validatorErrors: report.issues.numErrors,
    validatorWarnings: report.issues.numWarnings,
    threeJsLoad: threeResult,
  };
}

// Validates the ONE non-lossless step in this pipeline: converting jupiter's
// deprecated spec/gloss material to metal/rough so it actually renders. Confirms
// geometry is untouched and every texture NOT involved in the spec/gloss
// workflow (emissive, occlusion) survives byte-identical.
async function verifyMetalroughConversion(beforePath, afterPath) {
  const before = readGlb(beforePath);
  const after = readGlb(afterPath);
  const a = before.json;
  const b = after.json;

  assert.ok(
    (a.extensionsUsed || []).includes("KHR_materials_pbrSpecularGlossiness"),
    "Expected source to use KHR_materials_pbrSpecularGlossiness",
  );
  assert.ok(
    !(b.extensionsUsed || []).includes("KHR_materials_pbrSpecularGlossiness"),
    "metalrough did not remove the deprecated spec/gloss extension",
  );

  assert.ok(Math.abs(triangleCount(a) - triangleCount(b)) < 1, "metalrough changed triangle count");
  assert.equal(vertexCount(a), vertexCount(b), "metalrough changed vertex count");
  assert.equal((b.materials || []).length, (a.materials || []).length, "metalrough changed material count");

  // Slots untouched by the spec/gloss -> metal/rough rewrite must be byte-identical.
  const untouchedSlots = ["emissiveTexture", "occlusionTexture"];
  for (let i = 0; i < (a.materials || []).length; i++) {
    const matA = a.materials[i];
    const matB = b.materials.find((m) => m.name === matA.name);
    assert.ok(matB, `Missing material after metalrough: ${matA.name}`);
    for (const slot of untouchedSlots) {
      if (!matA[slot]) continue;
      const hashA = sha256(imageBytes(before, resolveImageIndex(a, matA[slot].index)));
      assert.ok(matB[slot], `metalrough dropped ${slot} on ${matA.name}`);
      const hashB = sha256(imageBytes(after, resolveImageIndex(b, matB[slot].index)));
      assert.equal(hashB, hashA, `metalrough altered untouched slot ${slot} on ${matA.name}`);
    }
  }

  const report = await gltfValidator.validateBytes(new Uint8Array(after.bytes), { maxIssues: 1000 });
  assert.equal(report.issues.numErrors, 0, `Khronos validator errors after metalrough: ${JSON.stringify(report.issues.messages)}`);
}

function collectTextureInventory(glb) {
  const d = glb.json;
  return (d.images || []).map((img, i) => {
    const bytes = imageBytes(glb, i);
    return { index: i, mimeType: img.mimeType, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

async function optimizeOne(model) {
  const sourcePath = path.join(MODELS_DIR, model.source);
  const finalPath = path.join(MODELS_DIR, model.final);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }

  const beforeBytes = fs.statSync(sourcePath).size;
  const beforeGlb = readGlb(sourcePath);
  const beforeSha = sha256(fs.readFileSync(sourcePath));

  const stageDir = path.join(RUN_TMP_DIR, model.id);
  fs.mkdirSync(stageDir, { recursive: true });

  // Effective input to the lossless chain: the raw source, unless a documented
  // pre-transform (currently just jupiter's metalrough conversion) runs first.
  let chainInput = sourcePath;
  let preprocessNote = null;
  if (model.preprocess === "metalrough") {
    const pre = path.join(stageDir, "0-metalrough.glb");
    run(GLTF_TRANSFORM_BIN, ["metalrough", sourcePath, pre]);
    await verifyMetalroughConversion(sourcePath, pre);
    chainInput = pre;
    preprocessNote = "KHR_materials_pbrSpecularGlossiness -> metal/rough (KHR_materials_specular + KHR_materials_ior) for Three.js compatibility";
  }

  const s1 = path.join(stageDir, "1-dedup.glb");
  const s2 = path.join(stageDir, "2-prune.glb");
  const s3 = path.join(stageDir, "3-weld.glb");
  const s4 = path.join(stageDir, "4-reorder.glb");

  run(GLTF_TRANSFORM_BIN, ["dedup", chainInput, s1]);
  run(GLTF_TRANSFORM_BIN, ["prune", s1, s2, "--keep-leaves", "true", "--keep-solid-textures", "true"]);
  run(GLTF_TRANSFORM_BIN, ["weld", s2, s3]);
  run(GLTF_TRANSFORM_BIN, ["reorder", s3, s4, "--target", "size"]);

  // The strict byte-identical-texture invariant is checked against chainInput
  // (post-preprocess), since dedup/prune/weld/reorder never touch pixels —
  // whatever metalrough legitimately changed was already verified above.
  const stats = await verifyLossless(chainInput, s4);
  stats.preprocess = preprocessNote;

  // Safety: confirm we never touched the source file on disk.
  assert.equal(sha256(fs.readFileSync(sourcePath)), beforeSha, "Source file was modified on disk!");

  const afterBytes = fs.statSync(s4).size;
  // A mandatory preprocess (currently: jupiter's metalrough correctness fix) must
  // never be discarded to chase a smaller file — reliability outranks size here.
  // Its output can legitimately be LARGER than the original; that's reported
  // honestly, not hidden by silently falling back to the broken original.
  const beneficial = model.preprocess ? true : afterBytes < beforeBytes;
  const finalBytes = beneficial ? afterBytes : beforeBytes;

  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  if (beneficial) {
    fs.copyFileSync(s4, finalPath);
  } else if (!model.alreadyFinal) {
    // Still required to produce the *-final.glb deliverable, but don't keep a
    // "optimized" copy that isn't actually smaller.
    fs.copyFileSync(sourcePath, finalPath);
  }
  // else: model.alreadyFinal and not beneficial -> leave the existing final file untouched.

  fs.rmSync(stageDir, { recursive: true, force: true });

  return {
    id: model.id,
    source: model.source,
    final: model.final,
    beforeBytes,
    afterBytes: finalBytes,
    beneficial,
    stats,
    beforeTextures: collectTextureInventory(beforeGlb).map((t) => ({ mimeType: t.mimeType, bytes: t.bytes })),
  };
}

async function main() {
  const requestedIds = process.argv.slice(2);
  const models = requestedIds.length
    ? MODELS.filter((m) => requestedIds.includes(m.id))
    : MODELS;

  if (models.length === 0) {
    console.error(`No matching models for: ${requestedIds.join(", ")}`);
    process.exit(1);
  }

  fs.mkdirSync(RUN_TMP_DIR, { recursive: true });

  const results = [];
  try {
    for (const model of models) {
      process.stdout.write(`\n=== ${model.id} (${model.source} -> ${model.final}) ===\n`);
      const result = await optimizeOne(model);
      results.push(result);
      const pct = ((1 - result.afterBytes / result.beforeBytes) * 100).toFixed(2);
      if (result.stats.preprocess) console.log(`  Preprocess: ${result.stats.preprocess}`);
      console.log(`  Before:     ${fmtBytes(result.beforeBytes)}`);
      console.log(`  After:      ${fmtBytes(result.afterBytes)}`);
      let note = "";
      if (!result.beneficial) note = "(no lossless reduction found; final file unchanged/copied as-is)";
      else if (result.afterBytes > result.beforeBytes) note = "(grew: required correctness fix re-encoded textures, see Preprocess above)";
      console.log(`  Reduction:  ${pct}%  ${note}`);
      console.log(`  Triangles:  ${result.stats.triangles.before} -> ${result.stats.triangles.after}`);
      console.log(`  Vertices:   ${result.stats.vertices.before} -> ${result.stats.vertices.after}`);
      console.log(`  Textures:   ${result.stats.textures.before} -> ${result.stats.textures.after} (byte-identical content verified)`);
      console.log(`  Validator:  ${result.stats.validatorErrors} errors, ${result.stats.validatorWarnings} warnings`);
      console.log(`  Three.js load: ${result.stats.threeJsLoad}`);
    }
  } catch (err) {
    console.error(`\nFAILED: ${err.message}`);
    console.error(err.stack);
    fs.rmSync(RUN_TMP_DIR, { recursive: true, force: true });
    process.exit(1);
  }

  fs.rmSync(RUN_TMP_DIR, { recursive: true, force: true });

  console.log("\n=== Summary ===");
  for (const r of results) {
    const pct = ((1 - r.afterBytes / r.beforeBytes) * 100).toFixed(2);
    console.log(`${r.id.padEnd(12)} ${fmtBytes(r.beforeBytes).padEnd(22)} -> ${fmtBytes(r.afterBytes).padEnd(22)} (${pct}%)`);
  }
}

main();
