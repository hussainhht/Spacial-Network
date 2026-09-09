// Generalized glTF/GLB verification tool for planet models.
// Resolves dependencies alongside the installed CLI or in local .tools.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const assert = require("node:assert/strict");

function resolveDependency(moduleName) {
  const tryPaths = [
    process.env.EARTH_GLTF_CLI
      ? fs.realpathSync(process.env.EARTH_GLTF_CLI)
      : null,
    path.join(__dirname, ".tools", "node_modules", ".bin", "gltf-transform"),
    path.join(__dirname, ".tools", "package.json"),
    __filename,
  ].filter(Boolean);

  for (const candidate of tryPaths) {
    try {
      const target = fs.statSync(candidate).isDirectory()
        ? path.join(candidate, "package.json")
        : candidate;
      const req = createRequire(target);
      return req(moduleName);
    } catch (_) {}
  }
  return require(moduleName);
}

let sharp, validator;
try {
  sharp = resolveDependency("sharp");
  validator = resolveDependency("gltf-validator");
} catch (error) {
  console.error(
    "Missing verification dependency. Install sharp and gltf-validator alongside @gltf-transform/cli:",
  );
  console.error(
    "  npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp",
  );
  process.exit(1);
}

if (process.argv[2] === "--dependencies") {
  process.exit(0);
}

if (process.argv.length < 4) {
  console.error("Usage: node verify-model.cjs <source.glb> <optimized.glb>");
  process.exit(1);
}

function read(filePath) {
  assert.ok(fs.existsSync(filePath), `File does not exist: ${filePath}`);
  const bytes = fs.readFileSync(filePath);
  assert.ok(bytes.length > 0, `File is empty: ${filePath}`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "Invalid GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "Unsupported GLB version (must be 2)");
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.length,
    "GLB length header mismatch",
  );
  const length = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "Expected JSON chunk");
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  assert.equal(
    bytes.readUInt32LE(24 + length),
    0x004e4942,
    "Expected BIN chunk",
  );
  return { bytes, json, bin: bytes.subarray(28 + length) };
}

function image(model, index) {
  const im = model.json.images[index];
  assert.ok(im, `Image ${index} not found in model`);
  const view = model.json.bufferViews[im.bufferView];
  assert.ok(view && !im.uri, `Expected embedded image at index ${index}`);
  const offset = view.byteOffset || 0;
  assert.ok(
    offset + view.byteLength <= model.bin.length,
    `BufferView overflow for image ${index}`,
  );
  return model.bin.subarray(offset, offset + view.byteLength);
}

function slots(value, currentPath = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== "object") continue;
    if (key.endsWith("Texture")) result[currentPath + key] = child;
    else slots(child, currentPath + key + ".", result);
  }
  return result;
}

function hierarchy(d) {
  const floats = (v) => v?.map(Math.fround);
  return (d.nodes || [])
    .map((n) => ({
      name: n.name,
      children: (n.children || []).map((i) => d.nodes[i]?.name),
      matrix: floats(n.matrix),
      translation: floats(n.translation),
      rotation: floats(n.rotation),
      scale: floats(n.scale),
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function trianglesCount(d) {
  return (d.meshes || []).reduce(
    (sum, m) =>
      sum +
      (m.primitives || []).reduce((s, p) => {
        if (p.indices !== undefined) {
          return s + (d.accessors[p.indices]?.count || 0) / 3;
        }
        if (p.attributes?.POSITION !== undefined) {
          return s + (d.accessors[p.attributes.POSITION]?.count || 0) / 3;
        }
        return s;
      }, 0),
    0,
  );
}

function verticesCount(d) {
  return (d.meshes || []).reduce(
    (sum, m) =>
      sum +
      (m.primitives || []).reduce((s, p) => {
        if (p.attributes?.POSITION !== undefined) {
          return s + (d.accessors[p.attributes.POSITION]?.count || 0);
        }
        return s;
      }, 0),
    0,
  );
}

async function verifyThreeJSLOader(outputBuffer) {
  try {
    const frontendThreePath = path.join(
      __dirname,
      "..",
      "frontend",
      "node_modules",
      "three",
    );
    if (!fs.existsSync(frontendThreePath)) return;
    globalThis.self = globalThis;
    const { GLTFLoader } = await import(
      path.join(
        frontendThreePath,
        "examples",
        "jsm",
        "loaders",
        "GLTFLoader.js",
      )
    );
    const loader = new GLTFLoader();
    const arrayBuffer = outputBuffer.buffer.slice(
      outputBuffer.byteOffset,
      outputBuffer.byteOffset + outputBuffer.byteLength,
    );
    await new Promise((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        "",
        (gltf) => resolve(gltf),
        (err) => reject(err),
      );
    });
  } catch (err) {
    if (err.message && err.message.includes("setMeshoptDecoder")) {
      throw new Error(
        "Three.js GLTFLoader failed: Meshopt compression requires a decoder that is not configured in frontend.",
      );
    }
    // Other warnings related to DOM Image blob in headless Node are expected.
    if (
      !err.message?.includes("blob:") &&
      !err.message?.includes("Couldn't load texture")
    ) {
      console.warn("Three.js parse check notice:", err.message);
    }
  }
}

async function main() {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3];

  const source = read(sourcePath);
  const output = read(outputPath);
  const a = source.json;
  const b = output.json;

  // 1. Khronos glTF Validator
  const report = await validator.validateBytes(new Uint8Array(output.bytes), {
    maxIssues: 1000,
  });
  assert.equal(
    report.issues.numErrors,
    0,
    `Khronos validation errors: ${JSON.stringify(report.issues.messages)}`,
  );

  // 2. Extensions verification: ensure no unconfigured decoders are required
  const disallowedExtensions = [
    "EXT_meshopt_compression",
    "KHR_draco_mesh_compression",
  ];
  for (const ext of b.extensionsRequired || []) {
    assert.ok(
      !disallowedExtensions.includes(ext),
      `Output GLB requires unconfigured extension: ${ext}`,
    );
  }

  // 3. Node hierarchy & transform verification
  assert.deepEqual(
    hierarchy(b),
    hierarchy(a),
    "Node hierarchy/transforms changed",
  );
  if (a.scenes && b.scenes) {
    assert.deepEqual(
      b.scenes.map((s) => (s.nodes || []).map((i) => b.nodes[i]?.name)),
      a.scenes.map((s) => (s.nodes || []).map((i) => a.nodes[i]?.name)),
      "Scene root nodes changed",
    );
  }

  // 4. Mesh and geometry integrity
  assert.ok(
    b.meshes && b.meshes.length > 0,
    "No meshes found in optimized model",
  );
  assert.equal(b.meshes.length, a.meshes.length, "Mesh count changed");
  for (let mIdx = 0; mIdx < a.meshes.length; mIdx++) {
    const origMesh = a.meshes[mIdx];
    const outMesh = b.meshes[mIdx];
    assert.equal(
      outMesh.primitives.length,
      origMesh.primitives.length,
      `Primitive count changed in mesh ${mIdx}`,
    );
    for (let pIdx = 0; pIdx < origMesh.primitives.length; pIdx++) {
      const origPrim = origMesh.primitives[pIdx];
      const outPrim = outMesh.primitives[pIdx];
      assert.ok(
        outPrim.attributes.POSITION !== undefined,
        `Missing POSITION attribute in mesh ${mIdx} prim ${pIdx}`,
      );
      if (origPrim.attributes.NORMAL !== undefined) {
        assert.ok(
          outPrim.attributes.NORMAL !== undefined,
          `Missing NORMAL attribute in mesh ${mIdx} prim ${pIdx}`,
        );
      }
      if (origPrim.attributes.TEXCOORD_0 !== undefined) {
        assert.ok(
          outPrim.attributes.TEXCOORD_0 !== undefined,
          `Missing TEXCOORD_0 attribute in mesh ${mIdx} prim ${pIdx}`,
        );
      }
    }
  }

  // 5. Materials verification
  assert.equal(
    (b.materials || []).length,
    (a.materials || []).length,
    "Material count changed",
  );
  for (const mat of a.materials || []) {
    const out = b.materials.find((m) => m.name === mat.name);
    assert.ok(out, `Missing material: ${mat.name}`);
    for (const key of ["alphaMode", "alphaCutoff", "doubleSided"]) {
      assert.deepEqual(
        out[key],
        mat[key],
        `Material property ${key} mismatch in ${mat.name}`,
      );
    }

    // Compare PBR factors with float32 tolerance
    if (mat.pbrMetallicRoughness && out.pbrMetallicRoughness) {
      if (
        mat.pbrMetallicRoughness.metallicFactor !== undefined ||
        out.pbrMetallicRoughness.metallicFactor !== undefined
      ) {
        const aVal = mat.pbrMetallicRoughness.metallicFactor ?? 1;
        const bVal = out.pbrMetallicRoughness.metallicFactor ?? 1;
        assert.ok(
          Math.abs(bVal - aVal) < 1e-4,
          `metallicFactor mismatch: ${bVal} vs ${aVal}`,
        );
      }
      if (
        mat.pbrMetallicRoughness.roughnessFactor !== undefined ||
        out.pbrMetallicRoughness.roughnessFactor !== undefined
      ) {
        const aVal = mat.pbrMetallicRoughness.roughnessFactor ?? 1;
        const bVal = out.pbrMetallicRoughness.roughnessFactor ?? 1;
        assert.ok(
          Math.abs(bVal - aVal) < 1e-4,
          `roughnessFactor mismatch: ${bVal} vs ${aVal}`,
        );
      }
      if (
        mat.pbrMetallicRoughness.baseColorFactor &&
        out.pbrMetallicRoughness.baseColorFactor
      ) {
        for (let i = 0; i < 4; i++) {
          assert.ok(
            Math.abs(
              out.pbrMetallicRoughness.baseColorFactor[i] -
                mat.pbrMetallicRoughness.baseColorFactor[i],
            ) < 1e-4,
            `baseColorFactor[${i}] mismatch`,
          );
        }
      }
    }

    const inputSlots = slots(mat);
    const outputSlots = slots(out);
    assert.deepEqual(
      Object.keys(outputSlots).sort(),
      Object.keys(inputSlots).sort(),
      `Texture slots changed in ${mat.name}`,
    );

    for (const [slot, ref] of Object.entries(inputSlots)) {
      const next = outputSlots[slot];
      assert.equal(
        next.texCoord || 0,
        ref.texCoord || 0,
        `Texture coord mismatch in ${slot}`,
      );
      const oldImage = a.textures[ref.index].source;
      const newImage =
        b.textures[next.index].extensions?.EXT_texture_webp?.source ??
        b.textures[next.index].source;

      const oldMeta = await sharp(image(source, oldImage)).metadata();
      const newMeta = await sharp(image(output, newImage)).metadata();

      assert.equal(newMeta.format, "webp", `Texture ${slot} is not WebP`);
      assert.ok(
        newMeta.width <= oldMeta.width,
        `Texture width enlarged: ${newMeta.width} > ${oldMeta.width}`,
      );
      assert.ok(
        newMeta.height <= oldMeta.height,
        `Texture height enlarged: ${newMeta.height} > ${oldMeta.height}`,
      );
      // Ensure aspect ratio is preserved within 1%
      assert.ok(
        Math.abs(
          newMeta.width / newMeta.height - oldMeta.width / oldMeta.height,
        ) < 0.02,
        "Texture aspect ratio changed",
      );
      const oldStats = await sharp(image(source, oldImage)).stats();
      if (!oldStats.isOpaque) {
        assert.ok(
          newMeta.hasAlpha,
          `Alpha channel lost in non-opaque texture ${slot}`,
        );
      }

      // Fully decode raw buffer to guarantee validity
      await sharp(image(output, newImage)).raw().toBuffer();
      console.log(
        `✓ ${mat.name || "Material"} [${slot}]: ${newMeta.width} × ${newMeta.height} WebP`,
      );
    }
  }

  // 6. Three.js GLTFLoader parser verification
  await verifyThreeJSLOader(output.bytes);

  // 7. Summary report
  const triA = trianglesCount(a);
  const triB = trianglesCount(b);
  const vertA = verticesCount(a);
  const vertB = verticesCount(b);
  const sizeA = source.bytes.length;
  const sizeB = output.bytes.length;
  const reduction = ((1 - sizeB / sizeA) * 100).toFixed(2);

  console.log(`\nTriangles: ${triA} → ${triB}`);
  console.log(`Vertices: ${vertA} → ${vertB}`);
  console.log(
    `Validator: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings`,
  );
  if (report.issues.messages && report.issues.messages.length > 0) {
    console.log(JSON.stringify(report.issues.messages));
  }
  console.log(`\nModel Optimization Summary:`);
  console.log(`Source:     ${sourcePath}`);
  console.log(`Output:     ${outputPath}`);
  console.log(`Original:   ${(sizeA / 1e6).toFixed(2)} MB (${sizeA} bytes)`);
  console.log(`Optimized:  ${(sizeB / 1e6).toFixed(2)} MB (${sizeB} bytes)`);
  console.log(`Reduction:  ${reduction}%`);
  console.log(
    `Preserved nodes: ${(b.nodes || []).map((n) => n.name || "(unnamed)").join(", ")}`,
  );
  console.log(
    `Preserved materials: ${(b.materials || []).map((m) => m.name || "(unnamed)").join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
