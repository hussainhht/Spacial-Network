# Planet 3D Models and Optimization Pipeline

# Planet 3D Models and Web Optimization Pipeline

All 3D planet assets and reproducible optimization tooling are maintained in this `3d/` directory.

## Models Overview

- `earth-00.glb`: Untouched original Earth export. Never overwrite or modify this file.
- `earth-final.glb`: Web-optimized Earth model.
- `24881_Mars_1_6792.glb`: Untouched original Mars source model. Never overwrite or modify this file.
- `mars-final.glb`: Web-optimized Mars model with embedded WebP textures and MikkTSpace tangents.
- `moon_small.glb`: Source Moon asset.
- `Saturn_1_120536.glb`: Source Saturn asset.
  | Planet / Body | Source File (Untouched Original) | Web Optimized Output (`*-final.glb`) |
  | --- | --- | --- |
  | **Earth** | `earth-00.glb` | `earth-final.glb` |
  | **Mars** | `24881_Mars_1_6792.glb` | `mars-final.glb` |
  | **Moon** | `moon_small.glb` | `moon-final.glb` |
  | **Saturn** | `Saturn_1_120536.glb` | `saturn-final.glb` |
  | **Black Hole** | `plant/black_hole.glb` | `black-hole-final.glb` |

> [!IMPORTANT]
> **Source files must never be overwritten, modified, or deleted.**
> Only the `*-final.glb` files are deployed to production and loaded by the frontend.

---

## Reusable Tooling

- `optimize-model.sh`: Generalized, reproducible planet optimization pipeline.
- `verify-model.cjs`: Generalized glTF/GLB validator verifying Khronos glTF compliance, mesh/hierarchy preservation, texture decoding, and Three.js `GLTFLoader` compatibility.
- `optimize-earth.sh`: Earth-specific pipeline preserving named nodes (`surface`, `cloud`, `atmo`).
- `verify-model.cjs`: Generalized glTF/GLB validator verifying Khronos compliance, node hierarchy, mesh primitives, material integrity, texture decoding, and Three.js `GLTFLoader` compatibility.
- `optimize-earth.sh`: Earth-specific pipeline wrapper preserving Earth-specific named nodes (`surface`, `cloud`, `atmo`).
- `verify-earth.cjs`: Earth-specific validation script.
- `optimize-black-hole.sh`: Black hole optimization pipeline preserving accretion disk silhouette and converting spec/gloss to metal/rough.
- `verify-black-hole.cjs`: Black hole validation script verifying triangle targets, WebP textures, and Three.js parsing.

### Prerequisites

Install required tools locally:

```bash
npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp
```

---

## Mars Optimization

## How to Optimize Any Model

### How to Regenerate Mars

To optimize a source model into its web-ready final version:

To regenerate `mars-final.glb` from the untouched source:

````bash
# General syntax:
bash 3d/optimize-model.sh <source.glb> <output-final.glb> [options]

```bash
# Mars:
bash 3d/optimize-model.sh 3d/24881_Mars_1_6792.glb 3d/mars-final.glb

# Moon:
bash 3d/optimize-model.sh 3d/moon_small.glb 3d/moon-final.glb

# Saturn:
bash 3d/optimize-model.sh 3d/Saturn_1_120536.glb 3d/saturn-final.glb

# Earth:
bash 3d/optimize-earth.sh
````

### Mars Pipeline Details

---

1. **Geometry preservation**: The source Mars geometry is already lightweight (3,072 triangles). gltfpack runs with `-kn -km -kv -noq` to preserve node hierarchy (`Cube.008`), material names (`Default OBJ.005`), and vertex attributes while avoiding lossy quantization.
2. **Tangent generation**: Mars uses a normal map (`mars_norm.jpg`). `gltf-transform tangents` automatically computes standard MikkTSpace vertex tangents, resolving glTF validator warnings and runtime shader overhead.
3. **Texture optimization**: Embedded textures (diffuse map and normal map at 2,048 × 1,536) are converted to WebP at quality 90 and effort 90 via `gltf-transform webp`. Redundant alpha channels on opaque maps are stripped without losing detail.
4. **Verification**: `verify-model.cjs` ensures 0 Khronos errors/warnings, verifies node/material structure, decodes all WebP images with `sharp`, and confirms Three.js `GLTFLoader` can parse the model without requiring extra decoders.

## How to Verify Any Model

### Mars Verified Results

```bash
# Verify Mars:
node 3d/verify-model.cjs 3d/24881_Mars_1_6792.glb 3d/mars-final.glb

| Metric             | Source (`24881_Mars_1_6792.glb`) |          Optimized (`mars-final.glb`) |
| ------------------ | -------------------------------: | ------------------------------------: |
| Bytes              |                        4,032,148 |                               503,632 |
| MB (decimal)       |                          4.03 MB |                               0.50 MB |
| Triangles          |                            3,072 |                3,072 (100% preserved) |
| Vertices           |                            2,034 | 2,021 (welded duplicate seam indices) |
| Normal Map         |       2,048 × 1,536 PNG (496 KB) |            2,048 × 1,536 WebP (29 KB) |
| Diffuse Map        |      2,048 × 1,536 PNG (3.36 MB) |           2,048 × 1,536 WebP (358 KB) |
| Extensions         |                             None |                    `EXT_texture_webp` |
| Tangents           |         None (runtime generated) |            MikkTSpace vertex tangents |
| Khronos Validation |     0 errors, 1 warning, 2 infos |         0 errors, 0 warnings, 2 infos |
# Verify Moon:
node 3d/verify-model.cjs 3d/moon_small.glb 3d/moon-final.glb

Size reduction: **87.51%**.
# Verify Saturn:
node 3d/verify-model.cjs 3d/Saturn_1_120536.glb 3d/saturn-final.glb

# Verify Earth:
node 3d/verify-model.cjs 3d/earth-00.glb 3d/earth-final.glb
```

---

## Earth Optimization

## Model Details & Verified Results

### How to Regenerate Earth

### 1. Mars (`mars-final.glb`)

```bash
bash 3d/optimize-earth.sh
```

- **Geometry**: Source has 3,072 triangles. gltfpack runs with `-kn -km -kv -noq` (no simplification needed; duplicate seam indices welded cleanly).
- **Tangents**: Standard MikkTSpace vertex tangents computed via `gltf-transform tangents` for normal map rendering.
- **Textures**: Diffuse and Normal maps (2,048 × 1,536) converted to WebP at quality 90 / effort 90.
- **Result**:
  - Original: **4.03 MB** (4,032,148 bytes)
  - Final: **0.50 MB** (503,632 bytes)
  - Reduction: **87.51%**
  - Triangles: 3,072 → 3,072 (100% preserved)
  - Khronos Validation: **0 errors, 0 warnings**
  - Preserved Nodes: `Cube.008`
  - Preserved Materials: `Default OBJ.005`

### Earth Pipeline Details

### 2. Moon (`moon-final.glb`)

1. Inspect installed versions/help and check dependencies and source existence.
2. Run gltfpack with `-si 0.08 -kn -km -kv -noq`. Simplification reduces excessive sphere geometry from 2.16M triangles to 173K triangles. Named nodes and materials remain independent.
3. Run glTF Transform resize with `--width 4096 --height 2048`.
4. Convert textures to WebP at quality 90 and effort 90 (`EXT_texture_webp`).
5. Validate the staged output with `verify-earth.cjs` before publishing `earth-final.glb`.

- **Geometry**: 23,232 triangles preserved (essential for accurate spherical crater silhouette).
- **Textures**: 4,096 × 4,096 PNG diffuse map (12.17 MB) converted to WebP at quality 90 / effort 90 (3.65 MB). 100% texture resolution and crater detail retained.
- **Result**:
  - Original: **13.80 MB** (13,799,876 bytes)
  - Final: **3.65 MB** (3,652,032 bytes)
  - Reduction: **73.54%**
  - Triangles: 23,232 → 23,232 (100% preserved)
  - Khronos Validation: **0 errors, 0 warnings**
  - Preserved Nodes: `Cube`, `Looks`
  - Preserved Materials: `Material.001`

### Earth Verified Results

### 3. Saturn (`saturn-final.glb`)

| Metric       | Source (`earth-00.glb`) | Optimized (`earth-final.glb`) |
| ------------ | ----------------------: | ----------------------------: |
| Bytes        |              58,405,888 |                     2,334,480 |
| MB (decimal) |                58.41 MB |                       2.33 MB |
| Triangles    |               2,162,688 |                       173,010 |
| Textures     |  Two 16,200 × 8,100 PNG |        Two 4,096 × 2,048 WebP |

- **Geometry & Rings**:
  - Body (`Saturn.001`): 3,072 triangles.
  - Top Ring (`RingsTop`): 128 triangles.
  - Bottom Ring (`RingsBottom`): 128 triangles.
  - Total triangles: 3,328 triangles (100% preserved).
- **Ring Transparency**:
  - Material `SaturnRings` maintains `alphaMode: BLEND`.
  - Texture `saturn_rings_25sat_outterRings.png` (4,096 × 16) retains its complete alpha channel (`hasAlpha: true`, `isOpaque: false`), ensuring ring gaps and translucency render properly.
- **Textures**:
  - Surface map (`saturn_diff.jpg` 4,096 × 3,072) converted to WebP (237 KB).
  - Ring map (`saturn_rings_25sat_outterRings` 4,096 × 16) converted to WebP with alpha (3.5 KB).
- **Result**:
  - Original: **5.48 MB** (5,476,584 bytes)
  - Final: **0.33 MB** (329,804 bytes)
  - Reduction: **93.98%**
  - Triangles: 3,328 → 3,328 (100% preserved)
  - Khronos Validation: **0 errors, 0 warnings**
  - Preserved Nodes: `Saturn.001`, `RingsTop`, `RingsBottom`
  - Preserved Materials: `None`, `SaturnRings`

Size reduction: **96.00%**. Simplification ratio: **0.08**.

### 4. Earth (`earth-final.glb`)

Tool references: [gltfpack](https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md) and [glTF Transform CLI](https://gltf-transform.dev/cli).

- **Geometry**: Simplified from 2,162,688 to 173,010 triangles via gltfpack `-si 0.08`.
- **Textures**: Two 16,200 × 8,100 maps resized to 4,096 × 2,048 WebP.
- **Result**:
  - Original: **58.41 MB** (58,405,888 bytes)
  - Final: **2.33 MB** (2,334,480 bytes)
  - Reduction: **96.00%**
  - Khronos Validation: **0 errors, 0 warnings**
  - Preserved Nodes: `surface`, `cloud`, `atmo`

### 5. Black Hole (`black-hole-final.glb`)

- **Geometry**: Selective per-mesh decimation via meshoptimizer reducing geometry from 534,196 triangles to 13,357 triangles (~97.5% reduction) while allocating 2,399 triangles to the primary accretion ring (`ring_ring_0`) to preserve its smooth circular silhouette.
- **Cleanup**: Pruned invisible/occluded geometry (`Planet_Planet_0` inside the event horizon) and 100% transparent shell (`distortion_0`).
- **PBR Conversion**: Converted deprecated `KHR_materials_pbrSpecularGlossiness` to standard `pbrMetallicRoughness` and `KHR_materials_specular`.
- **Textures**: Converted all diffuse, specular, and emissive textures to WebP (`EXT_texture_webp`) at quality 90 / effort 90, capped at 1024×1024 max.
- **Result**:
  - Original: **29.85 MB** (31,303,140 bytes)
  - Final: **1.67 MB** (1,747,672 bytes)
  - Reduction: **94.42%**
  - Triangles: 534,196 → 13,357 (target: 10,000–15,000)
  - Vertices: 466,279 → 10,595
  - Khronos Validation: **0 errors, 0 warnings**
  - Three.js Compatibility: Verified via `GLTFLoader` parse and headless WebGL render.

---

## Frontend Integration

All production models are located in `frontend/public/models/` and are directly importable in Next.js / React Three Fiber components via:

```tsx
import { useGLTF } from "@react-three/drei";

const { scene: earth } = useGLTF("/models/planets/earth-final.glb");
const { scene: mars } = useGLTF("/models/planets/mars-final.glb");
const { scene: moon } = useGLTF("/models/planets/moon-final.glb");
const { scene: saturn } = useGLTF("/models/planets/saturn-final.glb");
```

All models use standard web extensions (`EXT_texture_webp`) and do not require external wasm decoders like Meshopt or Draco.
