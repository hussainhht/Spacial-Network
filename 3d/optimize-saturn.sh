#!/usr/bin/env bash
set -euo pipefail

# Social Network — Saturn 3D Model Web Optimization Pipeline
# Reduces 1.1M-triangle Sketchfab source model to a lightweight, high-fidelity web asset.

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$PATH"

SOURCE="$DIR/plant/saturn.glb"
OUTPUT_DIR="$DIR/../final"
OUTPUT="$OUTPUT_DIR/saturn-final.glb"

[[ -f "$SOURCE" ]] || { echo "Missing source Saturn model: $SOURCE" >&2; exit 1; }

for tool in node gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Ensure dependencies in 3d/.tools are installed." >&2
    exit 1
  fi
done

TMP="$DIR/.tmp/opt-saturn-$$"
mkdir -p -- "$TMP"
trap 'rm -rf -- "$TMP"' EXIT ERR

# Check source checksum before doing anything
BEFORE_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"

echo "=== Optimizing Saturn Model ==="
echo "Source: $SOURCE (SHA-256: $BEFORE_HASH)"

# Step 1: Geometry decimation, ring reconstruction, transform normalization, and PBR modernization
NODE_PATH="$DIR/.tools/node_modules" node - "$SOURCE" "$TMP/stage1_canonical.glb" << 'NODE_SCRIPT'
const fs = require("node:fs");
const path = require("node:path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { metalRough, prune, dedup } = require("@gltf-transform/functions");

const sourcePath = process.argv[2];
const outputPath = process.argv[3];

(async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(sourcePath);
  const root = doc.getRoot();

  const bodyMesh = root.listMeshes()[0];
  const ringMesh = root.listMeshes()[1];

  const R_OUTER = 143095.37385124044;
  const S = 1.0 / R_OUTER;

  // 1. Process Saturn Body:
  // Preserves 30,720 triangles with smooth spherical curvature.
  // Rotates into canonical coordinates [x, z, -y] (polar axis = +Y, equator in XZ).
  const bodyPrim = bodyMesh.listPrimitives()[0];
  const bodyPos = bodyPrim.getAttribute("POSITION");
  const bodyNorm = bodyPrim.getAttribute("NORMAL");

  const count = bodyPos.getCount();
  for (let i = 0; i < count; i++) {
    const [x, y, z] = bodyPos.getElement(i, []);
    bodyPos.setElement(i, [x * S, z * S, -y * S]);

    if (bodyNorm) {
      const [nx, ny, nz] = bodyNorm.getElement(i, []);
      bodyNorm.setElement(i, [nx, nz, -ny]);
    }
  }

  // 2. Reconstruct Ring Annulus with High-Precision Circumferential Subdivision:
  // Uses the 14 concentric radial feature bands matching the source texture.
  // Generates 720 circumferential segments (0.5 deg per segment) for a smooth circular silhouette.
  const bandDefs = [
    { v: 0.0, r: 74980.48 },
    { v: 0.1875, r: 87584.01 },
    { v: 0.208333, r: 89013.75 },
    { v: 0.28125, r: 94028.07 },
    { v: 0.333333, r: 97649.35 },
    { v: 0.416667, r: 102903.22 },
    { v: 0.5, r: 109108.44 },
    { v: 0.583333, r: 114853.99 },
    { v: 0.59375, r: 115542.89 },
    { v: 0.666667, r: 120546.27 },
    { v: 0.71875, r: 124130.84 },
    { v: 0.791667, r: 129116.83 },
    { v: 0.8125, r: 130549.00 },
    { v: 1.0, r: 143095.37 }
  ];

  const N_SEGS = 720;
  const N_BANDS = bandDefs.length;
  const ringYTop = 73.102 * S;
  const ringYBot = -73.102 * S;

  const totalVertsPerSide = N_BANDS * (N_SEGS + 1);
  const ringVertCount = totalVertsPerSide * 2;

  const positions = new Float32Array(ringVertCount * 3);
  const normals = new Float32Array(ringVertCount * 3);
  const uvs = new Float32Array(ringVertCount * 2);

  const trisPerSide = (N_BANDS - 1) * N_SEGS * 2;
  const indices = new Uint32Array(trisPerSide * 2 * 3);

  let vPtr = 0;
  let iPtr = 0;

  // Top Surface: normal = [0, 1, 0]
  const topStartV = 0;
  for (let b = 0; b < N_BANDS; b++) {
    const r = bandDefs[b].r * S;
    const v = bandDefs[b].v;
    for (let s = 0; s <= N_SEGS; s++) {
      const frac = s / N_SEGS;
      const th = frac * 2 * Math.PI;
      const x = r * Math.cos(th);
      const z = -r * Math.sin(th);
      const u = frac + 0.75;

      positions[vPtr * 3] = x;
      positions[vPtr * 3 + 1] = ringYTop;
      positions[vPtr * 3 + 2] = z;

      normals[vPtr * 3] = 0;
      normals[vPtr * 3 + 1] = 1;
      normals[vPtr * 3 + 2] = 0;

      uvs[vPtr * 2] = u;
      uvs[vPtr * 2 + 1] = v;

      vPtr++;
    }
  }

  for (let b = 0; b < N_BANDS - 1; b++) {
    const row0 = topStartV + b * (N_SEGS + 1);
    const row1 = topStartV + (b + 1) * (N_SEGS + 1);
    for (let s = 0; s < N_SEGS; s++) {
      const i00 = row0 + s;
      const i01 = row0 + s + 1;
      const i10 = row1 + s;
      const i11 = row1 + s + 1;

      indices[iPtr++] = i00;
      indices[iPtr++] = i10;
      indices[iPtr++] = i11;

      indices[iPtr++] = i00;
      indices[iPtr++] = i11;
      indices[iPtr++] = i01;
    }
  }

  // Bottom Surface: normal = [0, -1, 0]
  const botStartV = vPtr;
  for (let b = 0; b < N_BANDS; b++) {
    const r = bandDefs[b].r * S;
    const v = bandDefs[b].v;
    for (let s = 0; s <= N_SEGS; s++) {
      const frac = s / N_SEGS;
      const th = frac * 2 * Math.PI;
      const x = r * Math.cos(th);
      const z = -r * Math.sin(th);
      const u = frac + 0.75;

      positions[vPtr * 3] = x;
      positions[vPtr * 3 + 1] = ringYBot;
      positions[vPtr * 3 + 2] = z;

      normals[vPtr * 3] = 0;
      normals[vPtr * 3 + 1] = -1;
      normals[vPtr * 3 + 2] = 0;

      uvs[vPtr * 2] = u;
      uvs[vPtr * 2 + 1] = v;

      vPtr++;
    }
  }

  for (let b = 0; b < N_BANDS - 1; b++) {
    const row0 = botStartV + b * (N_SEGS + 1);
    const row1 = botStartV + (b + 1) * (N_SEGS + 1);
    for (let s = 0; s < N_SEGS; s++) {
      const i00 = row0 + s;
      const i01 = row0 + s + 1;
      const i10 = row1 + s;
      const i11 = row1 + s + 1;

      indices[iPtr++] = i00;
      indices[iPtr++] = i11;
      indices[iPtr++] = i10;

      indices[iPtr++] = i00;
      indices[iPtr++] = i01;
      indices[iPtr++] = i11;
    }
  }

  const ringPrim = ringMesh.listPrimitives()[0];
  const ringPosAcc = doc.createAccessor().setType("VEC3").setArray(positions);
  const ringNormAcc = doc.createAccessor().setType("VEC3").setArray(normals);
  const ringUvAcc = doc.createAccessor().setType("VEC2").setArray(uvs);
  const ringIndAcc = doc.createAccessor().setType("SCALAR").setArray(indices);

  ringPrim.setAttribute("POSITION", ringPosAcc);
  ringPrim.setAttribute("NORMAL", ringNormAcc);
  ringPrim.setAttribute("TEXCOORD_0", ringUvAcc);
  ringPrim.setAttribute("TEXCOORD_1", null);
  ringPrim.setIndices(ringIndAcc);

  // 3. Remove all particles, moons, and unused meshes/nodes/materials
  for (const n of root.listNodes()) {
    const name = n.getName();
    if (name.includes("Mimas") || name.includes("Enceladus") || name.startsWith("Saturn2_B_saturn2_A_0")) {
      n.dispose();
    }
  }
  for (const m of root.listMeshes()) {
    const name = m.getName();
    if (name.includes("Mimas") || name.includes("Enceladus") || name.startsWith("Saturn2_B_saturn2_A_0")) {
      m.dispose();
    }
  }
  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    if (name.includes("Mimas") || name.includes("Enceladus") || name === "saturn2_A") {
      mat.dispose();
    }
  }

  // 4. Flatten scene nodes
  const scene = root.listScenes()[0];
  for (const n of scene.listChildren()) {
    n.dispose();
  }

  bodyMesh.setName("saturn_Planet_0");
  ringMesh.setName("ring_rings_0");

  const bodyNode = doc.createNode("saturn_Planet_0")
    .setMesh(bodyMesh)
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  const ringNode = doc.createNode("ring_rings_0")
    .setMesh(ringMesh)
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  scene.addChild(bodyNode);
  scene.addChild(ringNode);

  // 5. Materials
  const ringMat = root.listMaterials().find(m => m.getName() === "saturn2_B");
  if (ringMat) {
    ringMat.setName("rings");
    ringMat.setDoubleSided(true);
  }
  const bodyMat = root.listMaterials().find(m => m.getName() === "saturn1_A");
  if (bodyMat) {
    bodyMat.setName("Planet");
  }

  await doc.transform(metalRough());
  await doc.transform(prune());
  await doc.transform(dedup());

  // Clean up any unreferenced textures
  const usedTextures = new Set();
  for (const mat of root.listMaterials()) {
    if (mat.getBaseColorTexture()) usedTextures.add(mat.getBaseColorTexture());
    if (mat.getMetallicRoughnessTexture()) usedTextures.add(mat.getMetallicRoughnessTexture());
    if (mat.getNormalTexture()) usedTextures.add(mat.getNormalTexture());
    if (mat.getOcclusionTexture()) usedTextures.add(mat.getOcclusionTexture());
    if (mat.getEmissiveTexture()) usedTextures.add(mat.getEmissiveTexture());
  }
  for (const tex of root.listTextures()) {
    if (!usedTextures.has(tex)) {
      tex.dispose();
    }
  }

  await io.write(outputPath, doc);
  console.log("   ✓ Geometry reconstructed, centered, and converted to PBR.");
})();
NODE_SCRIPT

# Step 2: Texture compression using WebP (EXT_texture_webp) at quality 95
echo "Compressing textures to WebP (quality 95)..."
gltf-transform webp "$TMP/stage1_canonical.glb" "$TMP/stage2_webp.glb" --quality 95 --effort 95

# Step 3: Prune and deduplicate
echo "Pruning and deduplicating accessors..."
gltf-transform prune "$TMP/stage2_webp.glb" "$TMP/stage3_pruned.glb"
gltf-transform dedup "$TMP/stage3_pruned.glb" "$TMP/stage4_final.glb"

# Step 4: Safety verification - ensure source file SHA-256 is 100% untouched
AFTER_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"
if [[ "$BEFORE_HASH" != "$AFTER_HASH" ]]; then
  echo "CRITICAL ERROR: Source model $SOURCE was modified!" >&2
  exit 1
fi
echo "Source integrity verified: SHA-256 unchanged ($AFTER_HASH)"

# Step 5: Export to final/saturn-final.glb
mkdir -p -- "$OUTPUT_DIR"
cp "$TMP/stage4_final.glb" "$OUTPUT"
echo "Produced final model: $OUTPUT"

# Step 6: Run automated verification
NODE_PATH="$DIR/.tools/node_modules" node "$DIR/verify-saturn.cjs" "$OUTPUT"

echo "Optimization pipeline complete!"
