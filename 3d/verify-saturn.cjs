#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const toolsDir = path.join(__dirname, ".tools");
const toolsRequire = createRequire(path.join(toolsDir, "package.json"));
const validator = toolsRequire("gltf-validator");
const sharp = toolsRequire("sharp");
const { NodeIO } = toolsRequire("@gltf-transform/core");
const { ALL_EXTENSIONS } = toolsRequire("@gltf-transform/extensions");

const targetFile =
  process.argv[2] || path.join(__dirname, "..", "final", "saturn-final.glb");

if (!fs.existsSync(targetFile)) {
  console.error(`Error: Target file not found: ${targetFile}`);
  process.exit(1);
}

async function verify() {
  console.log(`=== Validating Saturn Model: ${targetFile} ===`);
  const stat = fs.statSync(targetFile);
  const sizeMb = stat.size / (1024 * 1024);
  console.log(
    `File Size: ${sizeMb.toFixed(2)} MB (${stat.size.toLocaleString()} bytes)`,
  );

  assert.ok(
    stat.size < 15 * 1024 * 1024,
    `File size ${sizeMb.toFixed(2)} MB exceeds 15 MB limit`,
  );

  // 1. Binary GLB Header Check
  const buffer = fs.readFileSync(targetFile);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, "Invalid GLB magic header");
  assert.equal(
    buffer.readUInt32LE(4),
    2,
    "Unsupported GLB version (expected 2)",
  );

  // 2. Khronos glTF Validator
  console.log("\n1. Running Khronos glTF Validator...");
  const report = await validator.validateBytes(new Uint8Array(buffer), {
    maxIssues: 100,
  });
  console.log(
    `   Errors: ${report.issues.numErrors}, Warnings: ${report.issues.numWarnings}, Infos: ${report.issues.numInfos}`,
  );
  if (report.issues.numErrors > 0 || report.issues.numWarnings > 0) {
    console.error(
      "Khronos issues:",
      JSON.stringify(report.issues.messages, null, 2),
    );
  }
  assert.equal(report.issues.numErrors, 0, "Khronos validator reported errors");
  assert.equal(
    report.issues.numWarnings,
    0,
    "Khronos validator reported warnings",
  );
  console.log("   ✓ Khronos validation PASSED (0 errors, 0 warnings)");

  // 3. glTF Transform Document Inspection
  console.log("\n2. Inspecting Scene Hierarchy & Geometry...");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(targetFile);
  const root = doc.getRoot();

  // Check extensions
  const requiredExts = root.listExtensionsUsed().map((e) => e.extensionName);
  console.log(`   Extensions used: [${requiredExts.join(", ")}]`);
  assert.ok(
    !requiredExts.includes("EXT_meshopt_compression"),
    "Disallowed required extension: EXT_meshopt_compression",
  );
  assert.ok(
    !requiredExts.includes("KHR_draco_mesh_compression"),
    "Disallowed required extension: KHR_draco_mesh_compression",
  );
  assert.ok(
    requiredExts.includes("EXT_texture_webp"),
    "Expected EXT_texture_webp extension",
  );

  // Check nodes
  const nodes = root.listNodes();
  const nodeNames = nodes.map((n) => n.getName());
  console.log(`   Nodes found: ${nodeNames.join(", ")}`);
  assert.ok(
    nodeNames.includes("saturn_Planet_0"),
    "Missing node: saturn_Planet_0",
  );
  assert.ok(nodeNames.includes("ring_rings_0"), "Missing node: ring_rings_0");

  let totalTris = 0;
  let totalVerts = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pCount = prim.getAttribute("POSITION").getCount();
      const iCount = prim.getIndices().getCount() / 3;
      totalVerts += pCount;
      totalTris += iCount;
      console.log(
        `   Mesh "${mesh.getName()}": ${pCount.toLocaleString()} vertices, ${iCount.toLocaleString()} triangles`,
      );
    }
  }

  console.log(
    `   Total Geometry: ${totalVerts.toLocaleString()} vertices, ${totalTris.toLocaleString()} triangles`,
  );
  assert.ok(
    totalTris >= 50000 && totalTris <= 150000,
    `Triangle count ${totalTris} outside target 50k–150k`,
  );
  console.log("   ✓ Geometry targets verified (within 50k–150k range)");

  // 4. Materials & Textures Verification
  console.log("\n3. Verifying Materials & Textures...");
  const materials = root.listMaterials();
  assert.equal(
    materials.length,
    2,
    `Expected exactly 2 materials, found ${materials.length}`,
  );

  const planetMat = materials.find((m) => m.getName() === "Planet");
  const ringsMat = materials.find((m) => m.getName() === "rings");
  assert.ok(planetMat, "Missing material: Planet");
  assert.ok(ringsMat, "Missing material: rings");

  assert.equal(
    planetMat.getAlphaMode(),
    "OPAQUE",
    "Planet material alphaMode must be OPAQUE",
  );
  assert.equal(
    ringsMat.getAlphaMode(),
    "BLEND",
    "Rings material alphaMode must be BLEND",
  );
  assert.equal(
    ringsMat.getDoubleSided(),
    true,
    "Rings material must be doubleSided",
  );

  assert.ok(
    planetMat.getBaseColorTexture(),
    "Planet material missing baseColorTexture",
  );
  assert.ok(
    planetMat.getMetallicRoughnessTexture(),
    "Planet material missing metallicRoughnessTexture",
  );
  assert.ok(
    ringsMat.getBaseColorTexture(),
    "Rings material missing baseColorTexture",
  );

  // Decode textures with sharp
  const textures = root.listTextures();
  console.log(`   Found ${textures.length} embedded textures.`);
  for (let i = 0; i < textures.length; i++) {
    const tex = textures[i];
    const imgBuf = Buffer.from(tex.getImage());
    const meta = await sharp(imgBuf).metadata();
    console.log(
      `   Texture ${i}: format=${meta.format}, ${meta.width}x${meta.height}, channels=${meta.channels}, alpha=${meta.hasAlpha}, size=${(imgBuf.length / 1024).toFixed(1)} KB`,
    );
    assert.equal(
      meta.format,
      "webp",
      `Expected webp format for texture ${i}, found ${meta.format}`,
    );
  }
  console.log("   ✓ Materials and textures verified");

  console.log("\n=== ALL VERIFICATION CHECKS PASSED ===");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
