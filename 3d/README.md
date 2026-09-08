# Earth model optimization

This repository uses `3d/`, although the task prompt calls it `.3d/`.
All model files and reusable tooling remain in the existing directory.

- `earth-00.glb`: untouched original export. Never overwrite this file.
- `earth-final.glb`: optimized copy for later use on the web.
- `optimize-earth.sh`: reproducible Linux/bash optimization pipeline.
- `verify-earth.cjs`: validation of the output and preservation of source structure.

## Rerun

Requires Node.js, npm, bash, coreutils, gltfpack and glTF Transform CLI.
Install tools locally (the script never installs packages automatically):

```bash
npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp
bash 3d/optimize-earth.sh
```

Alternatively, put an existing installation's executables on PATH. The initial
run used `/tmp/earth-optimize-tools/node_modules/.bin`. Verification dependencies
must be resolvable alongside the CLI. The script resolves model paths relative
to itself, so it also works when invoked from another working directory.

## Pipeline

1. Inspect installed versions/help and check dependencies and source existence.
2. Run gltfpack with `-si 0.08 -kn -km -kv -noq`. Simplification reduces excessive
   sphere geometry. Named nodes and materials remain independent, UV attributes
   are retained, and disabling quantization avoids extra transform nodes and UV
   quantization. The default simplification error limit remains enabled.
3. Run glTF Transform resize with `--width 4096 --height 2048`. These are maximum
   dimensions, preserving aspect ratio without enlarging smaller textures.
4. Convert textures to WebP at quality 90 and effort 90 to reduce download size.
   WebP supports alpha; it does not provide GPU texture compression. The final
   GLB requires a loader supporting `EXT_texture_webp`.
5. Validate the staged output before publishing it as `earth-final.glb`. Verify
   the source SHA-256 is unchanged, then remove this run's intermediate files.

The script uses `set -euo pipefail`, quotes paths, and leaves `.tmp/` in place on
failure. Successful runs remove `.tmp/`. An existing final output is replaced
only after verification. Run one optimization at a time because intermediate
paths are shared.

`surface`, `cloud`, and `atmo` must remain named, separate nodes so future React
Three Fiber and GSAP code can address them independently. The verifier checks
their meshes, hierarchy, float32-equivalent transforms, scene membership,
material assignments and properties, texture slots, UV sets, texture dimensions,
alpha-channel presence, image decoding, and Khronos glTF validation results.

## Verified result

| Metric | Source | Optimized |
| --- | ---: | ---: |
| Bytes | 58,405,888 | 2,334,480 |
| MB (decimal) | 58.41 | 2.33 |
| Triangles | 2,162,688 | 173,010 |
| Each of two textures | 16,200 × 8,100 PNG | 4,096 × 2,048 WebP |

Size reduction: **96.00%**. Final simplification target: **0.08**.
Tools inspected and used: gltfpack **1.2.0**, glTF Transform CLI **4.5.0**.
Khronos validation: **0 errors, 0 warnings**. Two informational unused-UV
messages are expected because original UVs are deliberately retained on the
untextured cloud and atmosphere meshes. All three required names are preserved.

## Visual verification and source limitations

Orthographic geometry previews show intact spherical silhouettes for all three
optimized meshes at the 0.08 ratio. Both decoded texture previews retain map
detail. This was a geometry/texture inspection, not an integrated Three.js render.

The original export does **not** contain a ready-made realistic Earth appearance:
cloud and atmosphere materials are opaque, untextured and double-sided, with no
alpha channels. The surface base-color map is grayscale; its metallic/roughness
map contains packed color channels. These existing assignments and material
settings are preserved. Optimization cannot supply missing cloud transparency
or realistic surface colors without changing the source appearance. A final
rendering review is still needed when appropriate materials are authored and
the asset is integrated; no frontend or scene integration was performed here.

Tool references: [gltfpack](https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md)
and [glTF Transform CLI](https://gltf-transform.dev/cli).
