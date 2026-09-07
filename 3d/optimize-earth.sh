#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$PATH"
SOURCE="$DIR/earth-00.glb"
TMP="$DIR/.tmp"
OUTPUT="$DIR/earth-final.glb"
[[ -f "$SOURCE" ]] || { echo "Missing source: $SOURCE" >&2; exit 1; }
for tool in node gltfpack gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Install Node.js and coreutils, then run:" >&2
    printf 'npm install --prefix %q gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp\n' "$DIR/.tools" >&2
    exit 1
  fi
done
export EARTH_GLTF_CLI="$(command -v gltf-transform)"
# Check verification dependencies before doing expensive work.
node "$DIR/verify-earth.cjs" --dependencies
gltfpack -v
gltf-transform --version
PACK_HELP="$(gltfpack -h 2>&1 || true)" # gltfpack 1.2 returns 1 for help.
RESIZE_HELP="$(gltf-transform resize --help)"
WEBP_HELP="$(gltf-transform webp --help)"
for flag in -si -kn -km -noq -kv; do
  [[ "$PACK_HELP" == *"$flag"* ]] || { echo "Unsupported gltfpack: missing $flag" >&2; exit 1; }
done
[[ "$RESIZE_HELP" == *--width* && "$RESIZE_HELP" == *--height* && "$WEBP_HELP" == *--quality* ]] || exit 1
mkdir -p -- "$TMP"
trap 'echo "Optimization failed; intermediate files retained in $TMP" >&2' ERR
BEFORE="$(sha256sum -- "$SOURCE")"
# No quantization: retain original node transforms, UV precision and hierarchy.
gltfpack -i "$SOURCE" -o "$TMP/earth-geometry.glb" -si 0.08 -kn -km -kv -noq
gltf-transform resize "$TMP/earth-geometry.glb" "$TMP/earth-resized.glb" --width 4096 --height 2048
gltf-transform webp "$TMP/earth-resized.glb" "$TMP/earth-final.glb" --quality 90 --effort 90
node "$DIR/verify-earth.cjs" "$SOURCE" "$TMP/earth-final.glb"
[[ "$BEFORE" == "$(sha256sum -- "$SOURCE")" ]] || { echo 'Source checksum changed!' >&2; exit 1; }
[[ ! -L "$OUTPUT" ]] || { echo "Refusing symlink output: $OUTPUT" >&2; exit 1; }
mv -- "$TMP/earth-final.glb" "$OUTPUT"
rm -- "$TMP/earth-geometry.glb" "$TMP/earth-resized.glb"
rmdir -- "$TMP"
printf '\nOutput: %s\n' "$OUTPUT"
