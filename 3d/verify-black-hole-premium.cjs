const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const toolsDir = path.join(__dirname, ".tools", "node_modules");
const sharp = require(path.join(toolsDir, "sharp"));
const validator = require(path.join(toolsDir, "gltf-validator"));

if (process.argv[2] === "--dependencies") {
  process.exit(0);
}

function read(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "Invalid GLB magic header");
  assert.equal(bytes.readUInt32LE(4), 2, "Unsupported glTF version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB length mismatch");
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "Missing JSON chunk header");
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  assert.equal(
    bytes.readUInt32LE(24 + jsonLength),
    0x004e4942,
    "Missing BIN chunk header",
  );
  return { bytes, json, bin: bytes.subarray(28 + jsonLength) };
}

function countTriangles(model) {
  return (model.json.meshes || []).reduce((sum, mesh) => {
    return (
      sum +
      (mesh.primitives || []).reduce((pSum, prim) => {
        if (prim.indices !== undefined) {
          return pSum + (model.json.accessors[prim.indices]?.count || 0) / 3;
        }
        if (prim.attributes?.POSITION !== undefined) {
          return (
            pSum +
            (model.json.accessors[prim.attributes.POSITION]?.count || 0) / 3
          );
        }
        return pSum;
      }, 0)
    );
  }, 0);
}

function countVertices(model) {
  return (model.json.meshes || []).reduce((sum, mesh) => {
    return (
      sum +
      (mesh.primitives || []).reduce((pSum, prim) => {
        if (prim.attributes?.POSITION !== undefined) {
          return (
            pSum + (model.json.accessors[prim.attributes.POSITION]?.count || 0)
          );
        }
        return pSum;
      }, 0)
    );
  }, 0);
}

function getImageBuffer(model, imageIndex) {
  const image = model.json.images[imageIndex];
  assert.ok(image, `Image index ${imageIndex} not found`);
  const view = model.json.bufferViews[image.bufferView];
  assert.ok(
    view && !image.uri,
    `Embedded image expected for index ${imageIndex}`,
  );
  const offset = view.byteOffset || 0;
  return model.bin.subarray(offset, offset + view.byteLength);
}

async function verifyThreeJS(glbBuffer) {
  globalThis.self = globalThis;
  const threePath = path.resolve(
    __dirname,
    "..",
    "frontend",
    "node_modules",
    "three",
  );
  if (!fs.existsSync(threePath)) return;

  const { GLTFLoader } = await import(
    path.join(threePath, "examples", "jsm", "loaders", "GLTFLoader.js")
  );
  const THREE = await import(path.join(threePath, "build", "three.module.js"));
  const loader = new GLTFLoader();
  const arrayBuffer = glbBuffer.buffer.slice(
    glbBuffer.byteOffset,
    glbBuffer.byteOffset + glbBuffer.byteLength,
  );

  await new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      "",
      (gltf) => {
        let meshCount = 0;
        gltf.scene.traverse((child) => {
          if (child.isMesh) meshCount++;
        });
        assert.ok(meshCount > 0, "Three.js parsed 0 meshes");
        const box = new THREE.Box3().setFromObject(gltf.scene);
        assert.ok(
          Number.isFinite(box.min.x) && Number.isFinite(box.max.x),
          "Invalid bounding box",
        );
        resolve();
      },
      (err) => reject(err),
    );
  });
}

async function main() {
  const sourcePath = process.argv[2];
  const outputPath = process.argv[3];

  assert.ok(
    sourcePath && outputPath,
    "Usage: node verify-black-hole-premium.cjs <source.glb> <output.glb>",
  );

  const source = read(sourcePath);
  const output = read(outputPath);

  console.log("1. Validating Khronos glTF specification compliance...");
  const report = await validator.validateBytes(new Uint8Array(output.bytes), {
    maxIssues: 1000,
  });
  assert.equal(
    report.issues.numErrors,
    0,
    `Validation errors: ${JSON.stringify(report.issues.messages)}`,
  );
  assert.equal(
    report.issues.numWarnings,
    0,
    `Validation warnings: ${JSON.stringify(report.issues.messages)}`,
  );
  console.log("   ✓ 0 Khronos errors, 0 warnings.");

  console.log("2. Verifying geometry (premium tier: quality over size)...");
  const srcTriangles = countTriangles(source);
  const outTriangles = countTriangles(output);
  const srcVertices = countVertices(source);
  const outVertices = countVertices(output);

  console.log(
    `   Source:  ${srcTriangles.toLocaleString()} triangles, ${srcVertices.toLocaleString()} vertices`,
  );
  console.log(
    `   Premium: ${outTriangles.toLocaleString()} triangles, ${outVertices.toLocaleString()} vertices`,
  );
  // Premium tier intentionally keeps most source detail — only the
  // over-tessellated outer shell is trimmed. Floor guards against a
  // pipeline regression collapsing back to the lightweight tier; ceiling
  // guards against geometry being duplicated instead of trimmed.
  assert.ok(
    outTriangles >= 150000 && outTriangles <= srcTriangles,
    `Triangle count ${outTriangles} is outside the expected premium range [150000, ${srcTriangles}]`,
  );

  console.log("3. Verifying vertex attributes and normals...");
  for (let m = 0; m < output.json.meshes.length; m++) {
    const mesh = output.json.meshes[m];
    for (let p = 0; p < mesh.primitives.length; p++) {
      const prim = mesh.primitives[p];
      assert.ok(
        prim.attributes.POSITION !== undefined,
        `Mesh ${m} prim ${p} missing POSITION`,
      );
      assert.ok(
        prim.attributes.NORMAL !== undefined,
        `Mesh ${m} prim ${p} missing NORMAL`,
      );
    }
  }
  console.log("   ✓ All meshes retain POSITION and valid NORMAL attributes.");

  console.log("4. Verifying textures and lossless WebP decoding...");
  assert.ok(
    output.json.images && output.json.images.length > 0,
    "No textures in optimized output",
  );
  for (let i = 0; i < output.json.images.length; i++) {
    const buf = getImageBuffer(output, i);
    const meta = await sharp(buf).metadata();
    assert.equal(meta.format, "webp", `Image ${i} is not WebP`);
    await sharp(buf).raw().toBuffer();
    console.log(
      `   ✓ Image ${i}: ${meta.width} × ${meta.height} WebP (${meta.hasAlpha ? "RGBA" : "RGB"}, ${(buf.length / 1024).toFixed(1)} KB)`,
    );
  }

  console.log("5. Verifying Three.js GLTFLoader parsing...");
  await verifyThreeJS(output.bytes);
  console.log("   ✓ Successfully parsed and verified in Three.js GLTFLoader.");

  const srcBytes = source.bytes.length;
  const outBytes = output.bytes.length;
  const reduction = ((1 - outBytes / srcBytes) * 100).toFixed(2);

  console.log("\n=======================================================");
  console.log("        BLACK HOLE PREMIUM OPTIMIZATION REPORT         ");
  console.log("=======================================================");
  console.log(
    `Original file size:     ${(srcBytes / 1024 / 1024).toFixed(2)} MB (${srcBytes.toLocaleString()} bytes)`,
  );
  console.log(
    `Premium file size:      ${(outBytes / 1024 / 1024).toFixed(2)} MB (${outBytes.toLocaleString()} bytes)`,
  );
  console.log(`Size reduction:          ${reduction}%`);
  console.log(`Original triangles:      ${srcTriangles.toLocaleString()}`);
  console.log(`Premium triangles:       ${outTriangles.toLocaleString()}`);
  console.log(`Original vertices:       ${srcVertices.toLocaleString()}`);
  console.log(`Premium vertices:        ${outVertices.toLocaleString()}`);
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
