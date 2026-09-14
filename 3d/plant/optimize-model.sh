#!/usr/bin/env bash
set -euo pipefail

# Reusable 3D planet model optimization pipeline.
# Usage:
#   ./optimize-model.sh <source.glb> <output.glb> [target-triangles] [options]
# A plain-integer positional argument (in either position after source) is treated as a
# target triangle count; the simplification ratio is derived automatically as
# target-triangles / source-triangles. Use --simplify to pass an explicit ratio instead.
# Options:
#   --simplify <ratio>      Simplification ratio for gltfpack (e.g. 0.08). Omit or 1.0 to keep geometry.
#                           Takes precedence over an automatically derived target-triangles ratio.
#   --permissive            Allow gltfpack to simplify across UV/attribute seams (-sp). Use when a
#                           model has many separate mesh islands and default mode barely reduces it.
#   --max-width <pixels>    Max texture width for gltf-transform resize (default: 4096).
#   --max-height <pixels>   Max texture height for gltf-transform resize (default: 2048).
#   --quality <0-100>       WebP texture quality (default: 90).
#   --effort <0-100>        WebP encoding effort (default: 90).
#   --tangents <auto|on|off> Generate MikkTSpace vertex tangents (default: auto).
#   --verifier <path>       Verification script path (default: verify-model.cjs).

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node_modules/.bin:$DIR/../.tools/node_modules/.bin:$PATH"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <source.glb> [output.glb] [options]" >&2
  exit 1
fi

SOURCE="$1"
shift 1

OUTPUT=""
TARGET_TRIANGLES=""
while [[ $# -gt 0 && "$1" != --* ]]; do
  if [[ "$1" =~ ^[0-9]+$ ]]; then
    TARGET_TRIANGLES="$1"
  elif [[ -z "$OUTPUT" ]]; then
    OUTPUT="$1"
  else
    echo "Unexpected positional argument: $1" >&2
    exit 1
  fi
  shift 1
done
if [[ -z "$OUTPUT" ]]; then
  SRC_BASE="$(basename "$SOURCE" .glb)"
  case "$SRC_BASE" in
    *earth*) FINAL_NAME="earth-final.glb" ;;
    *mars*)  FINAL_NAME="mars-final.glb" ;;
    *moon*)  FINAL_NAME="moon-final.glb" ;;
    *saturn*) FINAL_NAME="saturn-final.glb" ;;
    *-final) FINAL_NAME="${SRC_BASE}.glb" ;;
    *)       FINAL_NAME="${SRC_BASE}-final.glb" ;;
  esac

  if [[ -d "$PWD/fianl" || "$(basename "$PWD")" =~ ^pl[a]?nt$ ]]; then
    OUTPUT="fianl/$FINAL_NAME"
  elif [[ -d "$DIR/fianl" || "$(basename "$DIR")" =~ ^pl[a]?nt$ ]]; then
    OUTPUT="$DIR/fianl/$FINAL_NAME"
  else
    OUTPUT="3d/plnt/fianl/$FINAL_NAME"
  fi
fi

# Resolve relative paths relative to current working directory
[[ "$SOURCE" = /* ]] || SOURCE="$PWD/$SOURCE"
[[ "$OUTPUT" = /* ]] || OUTPUT="$PWD/$OUTPUT"

SIMPLIFY=""
PERMISSIVE=0
MAX_WIDTH="4096"
MAX_HEIGHT="4096"
QUALITY="90"
EFFORT="90"
TANGENTS="auto"

if [[ -f "$DIR/verify-model.cjs" ]]; then
  VERIFIER="$DIR/verify-model.cjs"
elif [[ -f "$DIR/../verify-model.cjs" ]]; then
  VERIFIER="$DIR/../verify-model.cjs"
else
  VERIFIER="verify-model.cjs"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --simplify)
      SIMPLIFY="$2"
      shift 2
      ;;
    --permissive)
      PERMISSIVE=1
      shift 1
      ;;
    --max-width)
      MAX_WIDTH="$2"
      shift 2
      ;;
    --max-height)
      MAX_HEIGHT="$2"
      shift 2
      ;;
    --quality)
      QUALITY="$2"
      shift 2
      ;;
    --effort)
      EFFORT="$2"
      shift 2
      ;;
    --tangents)
      TANGENTS="$2"
      shift 2
      ;;
    --verifier)
      VERIFIER="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

[[ -f "$SOURCE" ]] || { echo "Missing source file: $SOURCE" >&2; exit 1; }
[[ ! -L "$OUTPUT" ]] || { echo "Refusing symlink output: $OUTPUT" >&2; exit 1; }

for tool in node gltfpack gltf-transform sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Install Node.js and coreutils, then run:" >&2
    printf 'npm install --prefix %q gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp\n' "$DIR/.tools" >&2
    exit 1
  fi
done

if [[ -n "$TARGET_TRIANGLES" ]]; then
  if [[ -n "$SIMPLIFY" ]]; then
    echo "Note: --simplify $SIMPLIFY overrides the target-triangles ratio derived from $TARGET_TRIANGLES" >&2
  else
    ORIGINAL_TRIS="$(node -e '
      const fs = require("fs");
      const b = fs.readFileSync(process.argv[1]);
      const len = b.readUInt32LE(12);
      const j = JSON.parse(b.subarray(20, 20 + len).toString());
      const tris = (j.meshes || []).reduce((sum, m) => sum + (m.primitives || []).reduce((s, p) => {
        if (p.indices !== undefined) return s + (j.accessors[p.indices]?.count || 0) / 3;
        if (p.attributes && p.attributes.POSITION !== undefined) return s + (j.accessors[p.attributes.POSITION]?.count || 0) / 3;
        return s;
      }, 0), 0);
      process.stdout.write(String(Math.round(tris)));
    ' "$SOURCE")"
    SIMPLIFY="$(node -e '
      const target = Number(process.argv[1]);
      const original = Number(process.argv[2]);
      if (!(original > 0)) { process.stderr.write("Could not determine source triangle count\n"); process.exit(1); }
      let ratio = target / original;
      if (!(ratio > 0)) ratio = 0.01;
      if (ratio > 1) ratio = 1;
      process.stdout.write(ratio.toFixed(6));
    ' "$TARGET_TRIANGLES" "$ORIGINAL_TRIS")"
    echo "Target triangles: $TARGET_TRIANGLES (source has $ORIGINAL_TRIS) -> derived simplify ratio: $SIMPLIFY" >&2
  fi
fi

export EARTH_GLTF_CLI="$(command -v gltf-transform)"

# Check verification dependencies
node "$VERIFIER" --dependencies

PACK_HELP="$(gltfpack -h 2>&1 || true)"
RESIZE_HELP="$(gltf-transform resize --help)"
WEBP_HELP="$(gltf-transform webp --help)"

for flag in -kn -km -noq -kv; do
  [[ "$PACK_HELP" == *"$flag"* ]] || { echo "Unsupported gltfpack: missing $flag" >&2; exit 1; }
done
[[ "$RESIZE_HELP" == *--width* && "$RESIZE_HELP" == *--height* && "$WEBP_HELP" == *--quality* ]] || exit 1

STAGE_BASE="opt-$(basename "$OUTPUT" .glb)-$$"
TMP="$DIR/.tmp/$STAGE_BASE"
mkdir -p -- "$TMP"
trap 'echo "Optimization failed; intermediate files retained in $TMP" >&2' ERR

BEFORE="$(sha256sum -- "$SOURCE")"

# 1. Geometry stage with gltfpack
# No quantization (-noq): retain original node transforms, UV precision and hierarchy.
PACK_ARGS=(-i "$SOURCE" -o "$TMP/stage1-geom.glb" -kn -km -kv -noq)
if [[ -n "$SIMPLIFY" && "$SIMPLIFY" != "1.0" && "$SIMPLIFY" != "1" ]]; then
  PACK_ARGS+=(-si "$SIMPLIFY")
  if [[ "$PERMISSIVE" -eq 1 ]]; then
    PACK_ARGS+=(-sp)
  fi
fi

gltfpack "${PACK_ARGS[@]}"

CURRENT_STAGE="$TMP/stage1-geom.glb"

# 2. Tangents stage: calculate MikkTSpace tangents if needed
NEED_TANGENTS=0
if [[ "$TANGENTS" == "on" ]]; then
  NEED_TANGENTS=1
elif [[ "$TANGENTS" == "auto" ]]; then
  if node -e '
    const fs = require("fs");
    const b = fs.readFileSync(process.argv[1]);
    const len = b.readUInt32LE(12);
    const j = JSON.parse(b.subarray(20, 20 + len).toString());
    const hasNorm = (j.materials || []).some(m => m.normalTexture);
    process.exit(hasNorm ? 0 : 1);
  ' "$CURRENT_STAGE"; then
    NEED_TANGENTS=1
  fi
fi

if [[ "$NEED_TANGENTS" -eq 1 ]]; then
  gltf-transform tangents "$CURRENT_STAGE" "$TMP/stage2-tangents.glb"
  CURRENT_STAGE="$TMP/stage2-tangents.glb"
fi

# 3. Resize textures if needed
gltf-transform resize "$CURRENT_STAGE" "$TMP/stage3-resized.glb" --width "$MAX_WIDTH" --height "$MAX_HEIGHT"
CURRENT_STAGE="$TMP/stage3-resized.glb"

# 4. WebP texture compression stage
gltf-transform webp "$CURRENT_STAGE" "$TMP/stage4-final.glb" --quality "$QUALITY" --effort "$EFFORT"
CURRENT_STAGE="$TMP/stage4-final.glb"

# 5. Verification stage
node "$VERIFIER" "$SOURCE" "$CURRENT_STAGE"

# 6. Safety check: ensure source checksum is untouched
[[ "$BEFORE" == "$(sha256sum -- "$SOURCE")" ]] || { echo 'Source checksum changed!' >&2; exit 1; }

# 7. Atomically place output and cleanup
mkdir -p "$(dirname "$OUTPUT")"
mv -- "$CURRENT_STAGE" "$OUTPUT"
rm -rf -- "$TMP"
trap - ERR

printf '\nOptimized model created successfully: %s\n' "$OUTPUT"

