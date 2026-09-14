#!/usr/bin/env bash
set -euo pipefail

# Social Network — Earth 3D Model Optimization Pipeline
# Optimizes the Sketchfab Earth export (earth.glb) for web rendering.
#
# The frontend (frontend/src/components/space/PlanetModel.tsx) reads the
# Earth and Clouds meshes by name and renders them with their own baked
# textures (frontend/src/components/space/earthMaterials.ts). Only the
# atmosphere shell has no baked counterpart and stays procedural. This
# pipeline keeps the Earth and Clouds meshes/materials/textures, and drops
# only what's genuinely unused: the cloud-rotation animation (nothing in the
# frontend plays glTF animations) and the Earth material's emissive
# (night-lights) map (the surface material never reads emissive).

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$PATH"

SOURCE="$DIR/earth.glb"
OUTPUT="$DIR/earth-final.glb"
FRONTEND_OUTPUT="$DIR/../frontend/public/models/planets/earth-final.glb"

[[ -f "$SOURCE" ]] || { echo "Missing source: $SOURCE" >&2; exit 1; }

for tool in node gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Install it with:" >&2
    printf 'npm install --prefix %q gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp\n' "$DIR/.tools" >&2
    exit 1
  fi
done
export EARTH_GLTF_CLI="$(command -v gltf-transform)"

TMP="$DIR/.tmp/opt-earth-$$"
mkdir -p -- "$TMP"
trap 'rm -rf -- "$TMP"' EXIT ERR

BEFORE_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"
echo "=== Optimizing Earth Model ==="
echo "Source: $SOURCE (SHA256: $BEFORE_HASH)"

# Step 1: Drop the unused animation, Camera/Sun nodes and the Earth
# material's emissive map; mark both closed spheres single-sided (back faces
# are never visible, so this halves fragment shading cost for free). The
# Earth and Clouds meshes/materials/textures are kept as-is.
node - "$SOURCE" "$TMP/stage1.glb" << NODE_SCRIPT
const { NodeIO } = require("$DIR/.tools/node_modules/@gltf-transform/core");
const { KHRONOS_EXTENSIONS } = require("$DIR/.tools/node_modules/@gltf-transform/extensions");
const { weld, prune, dedup } = require("$DIR/.tools/node_modules/@gltf-transform/functions");

(async () => {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.read(process.argv[2]);
  const root = doc.getRoot();

  for (const anim of root.listAnimations()) anim.dispose();
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (name === "Camera" || name === "Sun") node.dispose();
  }
  for (const mat of root.listMaterials()) {
    if (mat.getName() === "Earth") {
      mat.setEmissiveTexture(null);
      mat.setEmissiveFactor([0, 0, 0]);
      mat.setDoubleSided(false);
    }
    if (mat.getName() === "Clouds") {
      mat.setDoubleSided(false);
    }
  }

  await doc.transform(weld(), prune(), dedup());
  await io.write(process.argv[3], doc);

  const meshNodeNames = root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName());
  for (const expected of ["Earth_Earth_0", "Clouds_Clouds_0"]) {
    if (!meshNodeNames.includes(expected)) {
      console.error("Expected mesh node missing after pruning:", expected, "found:", meshNodeNames);
      process.exit(1);
    }
  }
  if (root.listMeshes().length !== 2 || root.listMaterials().length !== 2) {
    console.error("Expected exactly two meshes and two materials after pruning.");
    process.exit(1);
  }
  console.log("  Kept mesh nodes:", meshNodeNames.join(", "));
})();
NODE_SCRIPT

# Step 2: WebP texture compression (EXT_texture_webp). The source basecolor
# map is already 4096x2048, matching this project's established Earth texture
# budget, so no resize step is needed.
gltf-transform webp "$TMP/stage1.glb" "$TMP/stage2.glb" --quality 90 --effort 90

# Step 3: Final prune + dedup pass.
gltf-transform prune "$TMP/stage2.glb" "$TMP/stage3.glb"
gltf-transform dedup "$TMP/stage3.glb" "$TMP/stage4-final.glb"

# Step 4: Validate structure, textures and Three.js GLTFLoader compatibility
# against the pre-compression intermediate (stage1), which is the same
# content the WebP/prune/dedup steps are supposed to preserve losslessly
# other than pixel re-encoding.
node "$DIR/verify-model.cjs" "$TMP/stage1.glb" "$TMP/stage4-final.glb"

# Step 5: Safety check - ensure the untouched source was never modified.
AFTER_HASH="$(sha256sum -- "$SOURCE" | awk '{print $1}')"
if [[ "$BEFORE_HASH" != "$AFTER_HASH" ]]; then
  echo "CRITICAL ERROR: Source file $SOURCE was modified! Checksums do not match." >&2
  exit 1
fi
echo "Source integrity verified: SHA-256 unchanged ($AFTER_HASH)"

# Step 6: Deploy.
[[ ! -L "$OUTPUT" ]] || { echo "Refusing symlink output: $OUTPUT" >&2; exit 1; }
cp -- "$TMP/stage4-final.glb" "$OUTPUT"
echo "Created: $OUTPUT"

mkdir -p -- "$(dirname -- "$FRONTEND_OUTPUT")"
cp -- "$TMP/stage4-final.glb" "$FRONTEND_OUTPUT"
echo "Created: $FRONTEND_OUTPUT"

echo "Optimization complete!"
