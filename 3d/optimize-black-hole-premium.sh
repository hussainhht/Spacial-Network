#!/usr/bin/env bash
set -euo pipefail

# Social Network — Black Hole 3D Model Optimization Pipeline (PREMIUM tier)
#
# Companion to optimize-black-hole.sh. That script targets a light,
# far-background body shared by every device. This one targets the "Black
# Hole" premium selectable model: visual quality is prioritized over file
# size/performance, on the assumption the viewer opted into a heavier model.
#
# Differences from the standard pipeline:
#   - Only the genuinely over-tessellated "blackoutside" shell (three
#     primitives totalling ~267k triangles, almost half the source) is
#     decimated, and only down to ~40% instead of ~1%. Every other mesh
#     (ring, ring2, center, light1/2/3) keeps most or all of its source
#     resolution.
#   - Textures are re-encoded lossless WebP (container savings only, no
#     visual quality loss) instead of quality-90 lossy WebP, and are not
#     resized (the source textures already top out at 1024px).

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$PATH"

SOURCE="$DIR/plant/black_hole.glb"
OUTPUT="$DIR/black-hole-premium.glb"
FRONTEND_OUTPUT="$DIR/../frontend/public/models/planets/black-hole-premium.glb"
PLANT_FINAL_OUTPUT="$DIR/plant/fianl/black-hole-premium.glb"

[[ -f "$SOURCE" ]] || { echo "Missing source black hole model: $SOURCE" >&2; exit 1; }

for tool in node gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Ensure dependencies in 3d/.tools are installed." >&2
    exit 1
  fi
done

TMP="$DIR/.tmp/opt-blackhole-premium-$$"
mkdir -p -- "$TMP"
trap 'rm -rf -- "$TMP"' EXIT ERR

BEFORE_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"

echo "=== Optimizing Black Hole Model (premium tier) ==="
echo "Source: $SOURCE (SHA256: $BEFORE_HASH)"

# Step 1: Light geometry cleanup only. Weld coincident vertices (lets the
# selective decimation below run without tearing seams) and drop the
# unused "Planet"/"distortion" helper meshes the standard pipeline also
# excludes (a tiny orbiting body and an untextured lensing shell with no
# refraction shader support in this renderer) — everything else keeps its
# authored triangle count.
node - "$TMP/stage1_simplified.glb" << 'NODE_SCRIPT'
const { NodeIO } = require("./3d/.tools/node_modules/@gltf-transform/core");
const { KHRONOS_EXTENSIONS } = require("./3d/.tools/node_modules/@gltf-transform/extensions");
const {
  weld,
  metalRough,
  prune,
  compactPrimitive,
  getGLPrimitiveCount,
} = require("./3d/.tools/node_modules/@gltf-transform/functions");
const { MeshoptSimplifier } = require("./3d/.tools/node_modules/meshoptimizer");

(async () => {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.read("3d/plant/black_hole.glb");
  const root = doc.getRoot();

  for (const n of root.listNodes()) {
    if (n.getName().includes("Planet") || n.getName().includes("distortion")) n.dispose();
  }
  for (const m of root.listMeshes()) {
    if (m.getName().includes("Planet") || m.getName().includes("distortion")) m.dispose();
  }
  for (const mat of root.listMaterials()) {
    if (mat.getName().includes("Planet") || mat.getName().includes("distortion")) mat.dispose();
  }

  await doc.transform(weld());
  await MeshoptSimplifier.ready;

  // Only "blackoutside" is dense enough (>100k tris per primitive, likely
  // redundant micro-geometry from a sculpt/boolean source rather than
  // meaningful silhouette detail) to be worth trimming even in the premium
  // tier, and only down to ~40% — not the ~1% the standard pipeline uses.
  for (const mesh of root.listMeshes()) {
    const meshName = mesh.getName();
    for (const prim of mesh.listPrimitives()) {
      const origTris = getGLPrimitiveCount(prim);
      if (!meshName.includes("blackoutside") || origTris <= 20000) continue;

      const targetTris = Math.round(origTris * 0.4);
      const position = prim.getAttribute("POSITION");
      const srcIndices = prim.getIndices();
      const posArray = position.getArray();
      const indArray = new Uint32Array(srcIndices.getArray());
      const targetCount = targetTris * 3;

      const [dstIndices] = MeshoptSimplifier.simplify(indArray, posArray, 3, targetCount, 0.01, []);
      srcIndices.setArray(dstIndices);
      compactPrimitive(prim);
    }
  }

  await doc.transform(metalRough());
  await doc.transform(prune());

  const tmpOut = process.argv[2] || "3d/.tmp/stage1_simplified.glb";
  await io.write(tmpOut, doc);
  console.log("   ✓ Trimmed only the over-tessellated outer shell; every other mesh kept at full source resolution.");
})();
NODE_SCRIPT

# Step 2: Lossless WebP re-encode (container savings only — pixel data is
# unchanged). Source textures already top out at 1024px, so no resize step.
gltf-transform webp "$TMP/stage1_simplified.glb" "$TMP/stage2_webp.glb" --lossless true

# Step 3: Prune and deduplicate duplicate textures/accessors.
gltf-transform prune "$TMP/stage2_webp.glb" "$TMP/stage3_pruned.glb"
gltf-transform dedup "$TMP/stage3_pruned.glb" "$TMP/stage4_final.glb"

# Step 4: Validate (Khronos compliance + Three.js parse), no triangle-count
# ceiling — this tier is intentionally heavier.
node "$DIR/verify-black-hole-premium.cjs" "$SOURCE" "$TMP/stage4_final.glb"

# Step 5: Safety check - ensure source checksum is 100% unchanged
AFTER_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"
if [[ "$BEFORE_HASH" != "$AFTER_HASH" ]]; then
  echo "CRITICAL ERROR: Source file $SOURCE was modified! Checksums do not match." >&2
  exit 1
fi
echo "Source integrity verified: SHA-256 unchanged ($AFTER_HASH)"

# Step 6: Deploy final premium model to destinations
cp "$TMP/stage4_final.glb" "$OUTPUT"
echo "Created: $OUTPUT"

mkdir -p "$(dirname "$PLANT_FINAL_OUTPUT")"
cp "$TMP/stage4_final.glb" "$PLANT_FINAL_OUTPUT"
echo "Created: $PLANT_FINAL_OUTPUT"

mkdir -p "$(dirname "$FRONTEND_OUTPUT")"
cp "$TMP/stage4_final.glb" "$FRONTEND_OUTPUT"
echo "Created: $FRONTEND_OUTPUT"

echo "Premium optimization complete!"
