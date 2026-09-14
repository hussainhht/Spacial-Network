#!/usr/bin/env bash
set -euo pipefail

# Social Network — Black Hole 3D Model Optimization Pipeline
# Optimizes the downloaded black hole model for far-background web rendering.

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$PATH"

SOURCE="$DIR/plant/black_hole.glb"
ORIGINAL_COPY="$DIR/black-hole-original.glb"
OUTPUT="$DIR/black-hole-final.glb"
FRONTEND_OUTPUT="$DIR/../frontend/public/models/planets/black-hole-final.glb"
PLANT_FINAL_OUTPUT="$DIR/plant/fianl/black-hole-final.glb"

[[ -f "$SOURCE" ]] || { echo "Missing source black hole model: $SOURCE" >&2; exit 1; }

for tool in node gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Ensure dependencies in 3d/.tools are installed." >&2
    exit 1
  fi
done

TMP="$DIR/.tmp/opt-blackhole-$$"
mkdir -p -- "$TMP"
trap 'rm -rf -- "$TMP"' EXIT ERR

# Check source checksum before doing anything
BEFORE_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"

echo "=== Optimizing Black Hole Model ==="
echo "Source: $SOURCE (SHA256: $BEFORE_HASH)"

# Step 1: Geometry decimation and node/mesh cleanup using glTF-Transform & Meshopt
node - "$TMP/stage1_simplified.glb" << 'NODE_SCRIPT'
const fs = require("node:fs");
const path = require("node:path");
const { NodeIO } = require("./3d/.tools/node_modules/@gltf-transform/core");
const { KHRONOS_EXTENSIONS } = require("./3d/.tools/node_modules/@gltf-transform/extensions");
const { 
  weld, 
  metalRough, 
  prune, 
  compactPrimitive,
  getGLPrimitiveCount,
  getPrimitiveVertexCount
} = require("./3d/.tools/node_modules/@gltf-transform/functions");
const { MeshoptSimplifier } = require("./3d/.tools/node_modules/meshoptimizer");

(async () => {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.read("3d/plant/black_hole.glb");
  const root = doc.getRoot();

  // 1. Remove invisible / unused geometry
  for (const n of root.listNodes()) {
    if (n.getName().includes("Planet") || n.getName().includes("distortion")) n.dispose();
  }
  for (const m of root.listMeshes()) {
    if (m.getName().includes("Planet") || m.getName().includes("distortion")) m.dispose();
  }
  for (const mat of root.listMaterials()) {
    if (mat.getName().includes("Planet") || mat.getName().includes("distortion")) mat.dispose();
  }

  // 2. Weld coincident vertices to enable clean decimation without tearing
  await doc.transform(weld());
  await MeshoptSimplifier.ready;

  // 3. Selective decimation tailored to maintain circular accretion disk silhouette
  for (const mesh of root.listMeshes()) {
    const meshName = mesh.getName();
    for (const prim of mesh.listPrimitives()) {
      const origTris = getGLPrimitiveCount(prim);
      let targetTris = 1500;
      let error = 0.01;

      if (meshName.includes("ring_ring_0")) {
        // Main accretion disk: preserve high resolution for smooth circular silhouette
        targetTris = 2400;
        error = 0.0001;
      } else if (meshName.includes("ring2")) {
        // Outer particle dust rings
        targetTris = 350;
        error = 0.02;
      } else if (meshName.includes("center")) {
        // Dark event horizon sphere
        targetTris = 800;
        error = 0.01;
      } else if (meshName.includes("light1")) {
        targetTris = 1800;
        error = 0.005;
      } else if (meshName.includes("light2")) {
        targetTris = 1600;
        error = 0.005;
      } else if (meshName.includes("light3")) {
        targetTris = 1600;
        error = 0.005;
      } else if (meshName.includes("blackoutside")) {
        targetTris = origTris > 100000 ? 1800 : 200;
        error = 0.005;
      }

      const position = prim.getAttribute("POSITION");
      const srcIndices = prim.getIndices();
      let posArray = position.getArray();
      let indArray = new Uint32Array(srcIndices.getArray());
      const targetCount = targetTris * 3;

      let [dstIndices, err] = MeshoptSimplifier.simplify(indArray, posArray, 3, targetCount, error, []);
      if (dstIndices.length > targetCount * 1.3) {
        const [sloppyIndices, sloppyErr] = MeshoptSimplifier.simplifySloppy(indArray, posArray, 3, null, targetCount, error);
        dstIndices = sloppyIndices;
      }

      srcIndices.setArray(dstIndices);
      compactPrimitive(prim);
    }
  }

  // 4. Convert deprecated KHR_materials_pbrSpecularGlossiness to modern standard pbrMetallicRoughness
  await doc.transform(metalRough());
  await doc.transform(prune());

  const tmpOut = process.argv[2] || "3d/.tmp/stage1_simplified.glb";
  await io.write(tmpOut, doc);
  console.log("   ✓ Geometry simplified and converted to metallic-roughness workflow.");
})();
NODE_SCRIPT

# Step 2: Texture resizing (cap at 1024x1024 max)
gltf-transform resize "$TMP/stage1_simplified.glb" "$TMP/stage2_resized.glb" --width 1024 --height 1024

# Step 3: WebP texture compression (EXT_texture_webp)
gltf-transform webp "$TMP/stage2_resized.glb" "$TMP/stage3_webp.glb" --quality 90 --effort 90

# Step 4: Prune and deduplicate duplicate textures/accessors
gltf-transform prune "$TMP/stage3_webp.glb" "$TMP/stage4_pruned.glb"
gltf-transform dedup "$TMP/stage4_pruned.glb" "$TMP/stage5_final.glb"

# Step 5: Validate
node "$DIR/verify-black-hole.cjs" "$SOURCE" "$TMP/stage5_final.glb"

# Step 6: Safety check - ensure source checksum is 100% unchanged
AFTER_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"
if [[ "$BEFORE_HASH" != "$AFTER_HASH" ]]; then
  echo "CRITICAL ERROR: Source file $SOURCE was modified! Checksums do not match." >&2
  exit 1
fi
echo "Source integrity verified: SHA-256 unchanged ($AFTER_HASH)"

# Step 7: Create untouched reference copy if not already present
if [[ ! -f "$ORIGINAL_COPY" ]]; then
  cp "$SOURCE" "$ORIGINAL_COPY"
  echo "Created untouched reference copy: $ORIGINAL_COPY"
fi

# Step 8: Deploy final optimized model to destinations
cp "$TMP/stage5_final.glb" "$OUTPUT"
echo "Created: $OUTPUT"

mkdir -p "$(dirname "$PLANT_FINAL_OUTPUT")"
cp "$TMP/stage5_final.glb" "$PLANT_FINAL_OUTPUT"
echo "Created: $PLANT_FINAL_OUTPUT"

mkdir -p "$(dirname "$FRONTEND_OUTPUT")"
cp "$TMP/stage5_final.glb" "$FRONTEND_OUTPUT"
echo "Created: $FRONTEND_OUTPUT"

echo "Optimization complete!"
