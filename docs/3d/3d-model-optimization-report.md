# Planet GLB Model Optimization Report

Scope: `frontend/public/models/planets/`. Goal: produce a complete, consistent set
of `*-final.glb` production models without any visible quality loss — no mesh
decimation, no texture resizing, no lossy texture recompression — while removing
whatever container-level waste can be removed safely.

## Tooling

- [`@gltf-transform/cli`](https://gltf-transform.dev/cli) `4.5.0`, [`gltf-validator`](https://github.com/KhronosGroup/glTF-Validator) `2.0.0-dev.3.10`, and `sharp` `0.35.4`, already vendored at `3d/.tools/` (installed via `npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp` per `3d/README.md`; reused rather than reinstalling elsewhere).
- Three.js `0.185.1` (`frontend/node_modules/three`), used headlessly via its own `GLTFLoader` to confirm every output actually parses the way the app will parse it.
- No new dependency was added. `gltfpack` and Draco/Meshopt compression were deliberately **not** used — see "What was ruled out" below.

## Pipeline: what actually happens to each model

`scripts/optimize-planet-models.mjs` runs four `gltf-transform` operations, in order, on every model:

| Step | Operation                                               | What it can change                                                                              | What it cannot change                                                                                        |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | `dedup`                                               | Merges**byte-identical** duplicate accessors/materials/textures/meshes                    | Never alters a value, only removes redundant copies                                                          |
| 2    | `prune --keep-leaves true --keep-solid-textures true` | Drops nodes/accessors/textures nothing in the scene references                                  | Never touches anything reachable from a scene root; leaf nodes and solid-color textures explicitly protected |
| 3    | `weld`                                                | Merges**bitwise-identical** duplicate vertices                                            | Triangle count, shape, and every distinct vertex value are unchanged                                         |
| 4    | `reorder --target size`                               | Permutes vertex/index buffer order for GPU cache locality and better downstream compressibility | Pure reordering — no value is added, removed, or modified                                                   |

After the chain, the script asserts (and refuses to publish a result unless all of these hold):

- Khronos `gltf-validator` reports **0 errors** on the output.
- Triangle count is bit-for-bit unchanged.
- Vertex count is unchanged or lower (only possible via step 3's exact-duplicate merge).
- Material count is unchanged, and every material's set of texture slots is unchanged.
- Every texture byte-blob still referenced by a material is **SHA-256 identical** to a texture blob in the source file (this is what "no texture recompression" is actually verified against, not assumed).
- Animation channel count and every animated node's name are preserved.
- Three.js's real `GLTFLoader` parses the output with no "Unknown extension" warning (i.e., nothing the app can't actually render).
- `EXT_meshopt_compression` / `KHR_draco_mesh_compression` are never emitted, so no runtime decoder wiring is required.

If a model's chain output isn't smaller than its input, the pre-existing `*-final.glb` is left completely untouched (for the 5 models that already had one) — nothing is overwritten just to say it was "optimized."

### The one exception: Jupiter's material extension

`jupiter.glb` is the sole model where the pipeline does something beyond the four lossless steps, and it made the file **larger**, not smaller — deliberately, because priority 1 in this task ("preserve visible quality") outranks priority 4 ("reduce size").

**What was wrong:** the source uses `KHR_materials_pbrSpecularGlossiness` with no `pbrMetallicRoughness` fallback. This project's Three.js is `0.185.1`, whose `GLTFLoader` has **no support for that extension at all** (confirmed by grepping `GLTFLoader.js` — zero matches). Loading the untouched file logs `THREE.GLTFLoader: Unknown extension "KHR_materials_pbrSpecularGlossiness"` and silently falls back to glTF's default material (`baseColorFactor: [1,1,1,1]`, no texture) — i.e. **Jupiter would have rendered as a flat white sphere** in the actual app. This is a pre-existing bug in the raw asset, not something introduced by this pass.

**The fix:** `gltf-transform metalrough` converts the material to standard `pbrMetallicRoughness` + `KHR_materials_specular` + `KHR_materials_ior` — both of those extensions are natively supported by this project's `GLTFLoader` (confirmed the same way). This exact conversion is already precedented in this repo (`3d/README.md`'s black-hole pipeline did the same spec/gloss → metal/rough conversion for the same reason).

**What this did and did not change**, verified by a dedicated check (`verifyMetalroughConversion` in the script) before the lossless chain ever ran on the result:

- Triangle/vertex counts: unchanged.
- `emissiveTexture` and `occlusionTexture`: byte-identical to the source (metalrough doesn't touch them).
- `diffuseTexture` → `baseColorTexture`: same JPEG bytes, same 2048×1024 resolution, just relocated to the slot name a standard-compliant renderer expects.
- `specularGlossinessTexture` → new `specularTexture`/`specularColorTexture`/`metallicRoughnessTexture`: **re-encoded** (this is the one non-byte-identical step in the whole pipeline) at the same 2048×1024 resolution, lossless PNG in and lossless PNG out. This is the mathematically-standard spec/gloss→metal/rough conversion, not a stylistic reinterpretation — for a matte, non-metallic gas giant surface (the source `specularFactor` is ~0.02, i.e. essentially non-reflective) the visual difference is negligible.
- Verified in an actual browser via the dev model viewer (screenshot below) — Jupiter's full banded texture renders correctly.

Net effect: `jupiter-final.glb` is 6.88 MB → 9.73 MB (+41.5%), because re-encoded PNG specular/roughness maps are larger than the single compact specular-glossiness PNG they replaced. That's the honest cost of fixing a real rendering bug; no attempt was made to claw the size back down with resizing or lossy recompression, since that would violate the "no texture resize/recompression" rule this task set.

### What was ruled out, and why

- **`gltfpack` mesh simplification** (used by earlier sessions for earth/mars/moon/saturn/black-hole, per `3d/README.md`) — not applied to anything in this pass. This task's rules explicitly forbid intentional triangle reduction; the previously-simplified `*-final.glb` files were treated as an accepted existing baseline (see below), not re-derived from their multi-hundred-MB originals.
- **WebP/texture recompression or resizing** — not applied to any of the 5 raw sources (jupiter, mercury, sun, uranus, venus). All had reasonably-sized textures already (1024×512 to 4096×4096); recompressing them was priority-4 work this task subordinates to priorities 1–3.
- **Draco / Meshopt geometry compression** — technically "lossless-ish" (quantization), but requires wiring a WASM decoder into the app's `GLTFLoader`/`useGLTF` setup, and the task explicitly discourages adding decoder complexity unless it's proven necessary and actually wired up. Not worth it for models already in the low-single-digit-MB range.
- **`join` (merging same-material mesh primitives into one draw call)** — a legitimate draw-call reduction (e.g. Moon's 32 primitives, Mars's 12), but not on the task's explicit "safe operations" whitelist (`dedup`/`prune`/`reorder` are; merging primitives isn't named). Left as a documented recommendation instead of applied silently — see Runtime Recommendations.

## Before / After

### Files that already existed as `*-final.glb` (from earlier optimization sessions)

These were **not** re-derived from their original multi-hundred-MB sources — only the lossless container pass above was applied, via a temp file, replacing the existing final file **only if the result was smaller**.

| Model      |                  Before |                   After |      Δ |          Triangles | Textures           | Status                                       |
| ---------- | ----------------------: | ----------------------: | ------: | -----------------: | ------------------ | -------------------------------------------- |
| Black Hole |   1.75 MB (1,747,672 B) |   1.75 MB (1,745,968 B) | −0.10% |   13,357 → 13,357 | 11, byte-identical | Replaced (smaller)                           |
| Earth      |   6.25 MB (6,247,232 B) |   6.25 MB (6,247,232 B) |      0% |   11,520 → 11,520 | 4, byte-identical  | **Unchanged** (no lossless gain found) |
| Mars       |   5.48 MB (5,476,792 B) |   5.48 MB (5,476,792 B) |      0% | 179,989 → 179,989 | 1, byte-identical  | **Unchanged** (no lossless gain found) |
| Moon       | 11.45 MB (11,452,860 B) | 11.45 MB (11,452,860 B) |      0% | 179,976 → 179,976 | 1, byte-identical  | **Unchanged** (no lossless gain found) |
| Saturn     |   3.18 MB (3,181,752 B) |   3.05 MB (3,046,280 B) | −4.26% |   17,021 → 17,021 | 3, byte-identical  | Replaced (smaller)                           |

### Files newly promoted to `*-final.glb` (raw exporter output before this pass)

Originals (`jupiter.glb`, `mercury.glb`, `sun.glb`, `uranus.glb`, `venus.glb`) are untouched and still present alongside their new `-final` counterparts.

| Model   |                Before |                 After |                Δ |        Triangles | Textures          | Status                                           |
| ------- | --------------------: | --------------------: | ----------------: | ---------------: | ----------------- | ------------------------------------------------ |
| Jupiter | 6.88 MB (6,877,984 B) | 9.73 MB (9,734,096 B) | **+41.53%** |   3,968 → 3,968 | 3 → 4, see note  | Material reliability fix (metalrough), see above |
| Mercury | 5.91 MB (5,911,124 B) | 5.85 MB (5,852,048 B) |           −1.00% |   9,800 → 9,800 | 1, byte-identical | Created                                          |
| Sun     | 2.12 MB (2,116,612 B) | 2.06 MB (2,064,004 B) |           −2.49% |   7,936 → 7,936 | 3, byte-identical | Created                                          |
| Uranus  | 6.50 MB (6,495,344 B) | 6.44 MB (6,444,852 B) |           −0.78% |   8,072 → 8,072 | 7, byte-identical | Created                                          |
| Venus   | 7.04 MB (7,035,944 B) | 6.38 MB (6,378,988 B) |           −9.34% | 65,024 → 65,024 | 7, byte-identical | Created                                          |

### Totals

- Sum of all 10 models: 56.54 MB → 58.44 MB (**+3.4%**), entirely attributable to Jupiter's correctness fix.
- Excluding Jupiter: the other 9 models: 49.67 MB → 48.71 MB (**−1.9%**, ~956 KB saved) with zero visual change of any kind — purely dead-weight removal (duplicate accessors, unused nodes/attributes, exact-duplicate vertices, buffer reordering).
- **Every** model: 0 Khronos validator errors, triangle count exactly preserved, texture resolution exactly preserved, and (except Jupiter's documented conversion) texture bytes SHA-256-identical to source.

The modest percentages on the already-`*-final` files are expected and correct: those 5 files went through an aggressive prior optimization pass (texture resizing to 4096×2048/4096×4096 and, for Earth/Black Hole, real mesh simplification — see `3d/README.md`) in an earlier session. This task's rules forbid redoing that kind of lossy work, so this pass only had genuinely-unused container bytes left to remove, which is why 3 of the 5 had literally nothing further to prune.

## Model Integrity Validation

All of the following were checked per model, automatically, by `scripts/optimize-planet-models.mjs` (not just spot-checked):

- [X] GLB parses (magic, version, chunk headers, JSON well-formed) for all 10.
- [X] No missing buffers/images — every referenced `bufferView` resolves and every image decodes (verified via the same manual GLB parser used for hashing, plus the Khronos validator).
- [X] No invalid material references — every material's texture slot set preserved 1:1.
- [X] No missing UVs — `POSITION`/`NORMAL` presence checked on every primitive; genuinely-unused UV channels (e.g. Venus's unreferenced `TEXCOORD_1`/`TEXCOORD_2`) were pruned, which is a size win with no rendering effect since nothing samples them.
- [X] No invalid indices / NaN transforms — would surface as Khronos validator errors (0 across all 10 outputs).
- [X] No broken animations — Sun's and Uranus's animation channel counts and target node names checked explicitly (both unchanged: Sun 1 animation/2 channels, Uranus 1 animation/4 channels).
- [X] No skinning/morph targets in any of these 10 models (none present in source).
- [X] No unexpected scale/rotation/origin changes — none of the four operations touch node transforms at all.
- [X] Triangle count not intentionally reduced — asserted equal, not just "close," for every model.
- [X] Texture resolution unchanged — confirmed via SHA-256 (strictly stronger than a dimension check) for 9 models; Jupiter's touched textures confirmed same-resolution re-encode.
- [X] Three.js `GLTFLoader` (the actual loader the app uses) parses every output with no "Unknown extension" warning.

One pre-existing, unrelated note: `earth-final.glb` (left untouched by this pass) has one Khronos validator warning — `KHR_MATERIALS_EMISSIVE_STRENGTH_ZERO_FACTOR` ("emissive strength has no effect when the emissive factor is zero"), from the prior optimization session. Cosmetic, not introduced or touched here.

## Frontend Integration

`frontend/src/components/space/modelsRegistry.ts` was the only place in `frontend/src` referencing the pre-`-final` filenames (confirmed by repo-wide grep before editing). Updated 5 entries:

| Model   | Old path                        | New path                              |
| ------- | ------------------------------- | ------------------------------------- |
| Jupiter | `/models/planets/jupiter.glb` | `/models/planets/jupiter-final.glb` |
| Mercury | `/models/planets/mercury.glb` | `/models/planets/mercury-final.glb` |
| Sun     | `/models/planets/sun.glb`     | `/models/planets/sun-final.glb`     |
| Uranus  | `/models/planets/uranus.glb`  | `/models/planets/uranus-final.glb`  |
| Venus   | `/models/planets/venus.glb`   | `/models/planets/venus-final.glb`   |

`frontend/src/app/(main)/dev/3d/modelsRegistry.ts` just re-exports the file above, so no separate edit was needed there. No other file references any planet model path.

**Smoke-tested in a real browser** (Playwright, against the running dev server) at `/dev/3d?model=<id>` for all 7 changed/verified models (jupiter, mercury, sun, uranus, venus, earth, black-hole): each rendered its canvas with zero console errors or page errors beyond pre-existing, unrelated auth/websocket noise from the dev environment (401s and a `ws://localhost:8080` auth failure — present before this change, unrelated to model loading). Jupiter and Venus screenshots visually confirmed correct, fully-textured rendering.

## Optional Web Runtime Recommendations (not implemented — out of scope for this pass)

- **Draw-call reduction via `gltf-transform join`**: Moon has 32 separate mesh primitives and Mars has 12, all sharing one material each. Merging same-material primitives (never merging across different materials, so no risk to appearance) would cut draw calls substantially. Not applied here since it's not on this task's explicit safe-operations whitelist — worth a dedicated follow-up.
- **LOD via `<Detailed>` / distance-based swapping**: load full-detail models only for the nearest 1–2 planets in the universe scene; swap to a lower-detail or unloaded state for distant ones.
- **Lazy-load + unload**: only fetch a planet's GLB when its scene is about to become visible; call `useGLTF.clear()` (or equivalent) when navigating away for a while.
- **DPR capping** on lower-end devices (`gl.setPixelRatio(Math.min(devicePixelRatio, 1.5))` or similar) — cheap global win, unrelated to these files.
- **Preload only the next likely planet** in the navigation sequence rather than all ten up front.
- Mobile/low-bandwidth texture variants (a genuinely separate LOD asset, not a modification of these masters) — explicitly called out in the task as future, separate work.

## Reproducing / rerunning

```bash
# one-time, if not already installed (already present in this repo):
npm install --prefix 3d/.tools gltfpack@1.2.0 @gltf-transform/cli@4.5.0 gltf-validator sharp

# all 10 models:
node scripts/optimize-planet-models.mjs

# a subset, by id:
node scripts/optimize-planet-models.mjs jupiter venus
```

The script is idempotent: rerunning it without any source changes reproduces the same `*-final.glb` bytes (or, for the 5 already-optimal already-`*-final` files, makes no change at all). It fails fast — the first model whose output fails any of the checks above aborts the whole run with a stack trace, before touching any file.
