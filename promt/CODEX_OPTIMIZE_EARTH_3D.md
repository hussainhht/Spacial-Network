# Codex Prompt — Optimize Earth 3D Model for Web

Work only with the 3D Earth model inside this folder:

```text
social-network/
└── .3d/
    └── earth-00.glb
```

The source model is:

```text
.3d/earth-00.glb
```

Do **not** modify or overwrite the original file.

The final optimized model should also stay inside the `.3d` folder.

---

## Goal

Prepare a web-optimized copy of the Earth model for later use with:

- Next.js
- Three.js
- React Three Fiber
- GSAP
- ScrollTrigger

Create a reusable optimization script at:

```text
.3d/optimize-earth.sh
```

The script should use:

```text
.3d/earth-00.glb
```

as its input and generate:

```text
.3d/earth-final.glb
```

---

## Important Model Structure

The existing GLB contains important named nodes/layers such as:

- `surface`
- `cloud`
- `atmo`

These names are important because later they will be targeted independently from React Three Fiber and GSAP.

Do not:

- remove them
- rename them
- merge them together
- destroy their hierarchy

Preserve these named nodes in the final GLB.

---

# Optimization Pipeline

Use:

1. `gltfpack`
2. `@gltf-transform/cli`

Before running commands, inspect the installed CLI versions/help so the syntax matches the installed tools.

Do not blindly assume CLI syntax.

---

## Step 1 — Geometry Optimization

Use `gltfpack` to reduce the model's excessive geometry.

The Earth is primarily sphere-based geometry and does not need extremely dense geometry for web use.

Start with approximately:

```text
-si 0.08
```

Preserve named nodes and materials.

Use the appropriate options equivalent to:

```text
-kn
-km
```

Input:

```text
.3d/earth-00.glb
```

Temporary output:

```text
.3d/.tmp/earth-geometry.glb
```

If `0.08` visibly damages the model, increase the simplification ratio and document the final value used.

---

## Step 2 — Texture Optimization

The original Earth may contain extremely high-resolution textures.

Resize large Earth textures to a web-friendly maximum size.

Target approximately:

```text
4096 × 2048
```

when the texture is a 2:1 Earth map.

Important:

- Do not upscale smaller textures.
- Preserve transparency.
- Preserve UV mapping.
- Preserve materials.
- Keep the visual quality suitable for a premium realistic Earth.

Use `gltf-transform` for texture resizing.

Temporary output:

```text
.3d/.tmp/earth-resized.glb
```

---

## Step 3 — WebP Texture Compression

Convert compatible textures to WebP using `gltf-transform`.

Use good visual quality suitable for a premium website.

Do not break:

- cloud transparency
- atmosphere transparency
- alpha channels
- material references

Final output:

```text
.3d/earth-final.glb
```

---

# Safety Requirements

The script must:

- use `set -euo pipefail`
- never overwrite `.3d/earth-00.glb`
- create required directories automatically
- use `.3d/.tmp/` for intermediate files
- stop if the source GLB does not exist
- stop with a clear error if required tools are missing
- not globally install packages automatically
- print the required install command when a dependency is missing
- quote all paths correctly
- work on Linux/bash
- preserve the original source model

Do not delete temporary files when optimization fails.

Delete temporary files after successful completion.

---

# Verification

After optimization, verify the final GLB.

Check that these named nodes still exist:

```text
surface
cloud
atmo
```

Use an available inspection tool such as:

```bash
gltf-transform inspect
```

or another reliable local GLTF inspection method.

If any required node is missing, treat the optimization as failed.

Also verify:

- `.3d/earth-final.glb` can be parsed successfully
- materials still exist
- textures are still assigned
- there are no broken references
- transparency is preserved where required
- the output is visually usable

---

# Size Report

At the end, print a report similar to:

```text
Earth Web Optimization

Original:
56.2 MB

Optimized:
6.8 MB

Reduction:
87.9%

Preserved nodes:
✓ surface
✓ cloud
✓ atmo

Output:
.3d/earth-final.glb
```

Calculate the real values from the files.

---

# Create Documentation

Also create:

```text
.3d/README.md
```

Document:

- what `earth-00.glb` is
- that it is the untouched source model
- what `earth-final.glb` is
- what `optimize-earth.sh` does
- why the geometry is simplified
- why textures are resized
- why WebP is used
- why `surface`, `cloud`, and `atmo` must be preserved
- how to rerun the optimization

Example:

```bash
bash .3d/optimize-earth.sh
```

---

# Folder Structure After Completion

The `.3d` directory should look approximately like:

```text
.3d/
├── earth-00.glb
├── earth-final.glb
├── optimize-earth.sh
└── README.md
```

`.tmp/` should only remain if the optimization fails.

---

# Project Boundaries

For this task, do NOT:

- integrate the Earth into React
- install React Three Fiber
- add Three.js scene code
- add GSAP
- add ScrollTrigger
- modify frontend pages
- modify frontend components
- modify backend code
- modify database code
- modify Docker configuration
- modify `.3d/earth-00.glb`

Only work on optimization tooling and files inside:

```text
.3d/
```

---

# Execution

After creating the script:

1. Inspect `.3d/earth-00.glb`.
2. Create `.3d/optimize-earth.sh`.
3. Run the script.
4. Fix any CLI/script errors encountered.
5. Verify `.3d/earth-final.glb`.
6. Verify `surface`, `cloud`, and `atmo` are preserved.
7. Create `.3d/README.md`.
8. Report:
   - original file size
   - final file size
   - reduction percentage
   - final simplification ratio used
   - texture resolution used
   - preserved node names
   - final output path
9. Do not continue into React/Three.js/GSAP integration.
