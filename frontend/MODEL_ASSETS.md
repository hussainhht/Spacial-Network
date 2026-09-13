# Model asset inventory

No model assets were deleted or modified. All 31 GLBs have valid GLB 2 container headers and embedded JSON with mesh data. This is a container/inventory check, not a visual or full glTF validator certification. No external buffer/image URIs were found.

Public models: **10 files, 55.74 MiB**. Source/export collection: **21 files, 478.83 MiB**.

No Neptune model is present; no placeholder path or asset was invented.

## Preserved public models

| File | MiB | Meshes | SHA-256 prefix |
| --- | ---: | ---: | --- |
| `public/models/planets/black-hole-final.glb` | 1.67 | 12 | `a8f4b8fabaa420af` |
| `public/models/planets/earth-final.glb` | 5.96 | 3 | `11a75c6b785a5e42` |
| `public/models/planets/jupiter-final.glb` | 9.28 | 1 | `9f1b837a4c07cca4` |
| `public/models/planets/mars-final.glb` | 5.22 | 12 | `15430386427e6ea0` |
| `public/models/planets/mercury-final.glb` | 5.58 | 1 | `6b0204f82a929381` |
| `public/models/planets/moon-final.glb` | 10.92 | 32 | `09c590e2b67e4564` |
| `public/models/planets/saturn-final.glb` | 2.91 | 2 | `b0cda20d5ee7eaf6` |
| `public/models/planets/sun-final.glb` | 1.97 | 2 | `af3840b250d08226` |
| `public/models/planets/uranus-final.glb` | 6.15 | 3 | `9001d0069119121e` |
| `public/models/planets/venus-final.glb` | 6.08 | 2 | `62c68f1f7d3c2a72` |

## Source/export copies to review later

These files are outside the frontend runtime. Similar names are not proof of duplication. Full SHA-256 comparison identifies the exact duplicates listed below; different exports remain untouched.

| File | MiB | SHA-256 prefix |
| --- | ---: | --- |
| `3d/plant/saturn.glb` | 143.04 | `aac5f6f65798d343` |
| `3d/plant/nasa_cgi_moon_4k.glb` | 79.21 | `ba80180229ee2bba` |
| `3d/earth-00.glb` | 55.70 | `2aed9e26e7577d89` |
| `3d/plant/4k_mars.glb` | 46.42 | `8e18d1bf6de99ecc` |
| `3d/black-hole-original.glb` | 29.85 | `c3e0696e657898e8` |
| `3d/plant/black_hole.glb` | 29.85 | `c3e0696e657898e8` |
| `3d/plant/realistic_earth_8k.glb` | 16.93 | `1173d398b56106a2` |
| `3d/moon_small.glb` | 13.16 | `12d3b0bb7fe21490` |
| `3d/plant/fianl/moon-final.glb` | 10.92 | `09c590e2b67e4564` |
| `3d/plant/venus.glb` | 6.71 | `c67003e41c639e5e` |
| `3d/plant/jupiter.glb` | 6.56 | `9d283d70cb737395` |
| `3d/plant/uranus.glb` | 6.19 | `28c6fc6959c5353b` |
| `3d/plant/fianl/earth-final.glb` | 5.96 | `11a75c6b785a5e42` |
| `3d/plant/mercury.glb` | 5.64 | `086fbea3496a3fbd` |
| `3d/plant/fianl/mars-final.glb` | 5.22 | `15430386427e6ea0` |
| `3d/Saturn_1_120536.glb` | 5.22 | `8dbfde533b13e938` |
| `3d/24881_Mars_1_6792.glb` | 3.85 | `0d27fc65fe3e6a58` |
| `3d/plant/fianl/saturn-final.glb` | 3.03 | `e544c7f0904be385` |
| `3d/plant/sun.glb` | 2.02 | `5b17f3d40ca7a577` |
| `3d/black-hole-final.glb` | 1.67 | `35119a6430c70f51` |
| `3d/plant/fianl/black-hole-final.glb` | 1.67 | `35119a6430c70f51` |

## Exact duplicate groups

- `frontend/public/models/planets/moon-final.glb` = `3d/plant/fianl/moon-final.glb`
- `frontend/public/models/planets/earth-final.glb` = `3d/plant/fianl/earth-final.glb`
- `frontend/public/models/planets/mars-final.glb` = `3d/plant/fianl/mars-final.glb`
- `3d/black-hole-final.glb` = `3d/plant/fianl/black-hole-final.glb`
- `3d/black-hole-original.glb` = `3d/plant/black_hole.glb`

Earth, Mars, and Moon under `3d/plant/fianl/` duplicate their public copies. The Saturn and black-hole files with matching final filenames are different exports; they must not be treated as interchangeable. Source files may be needed for re-exporting, so removal needs a separate asset decision.

## Re-verification — September 13, 2026

All 31 SHA-256 hashes above were recomputed independently and match this document exactly; nothing in `3d/` or `frontend/public/models/planets/` has drifted, and no new duplicates or files appeared. No files were deleted during this pass: none of the five duplicate groups meet all of the required conditions for safe removal (definitely unused, exact duplicate, no source-asset reason to keep, clearly safe) — `3d/` is a source-asset staging area that may still be needed for re-exporting, so the deletion decision remains with the asset owner, not an automated cleanup.
