# Shared space visuals

`SpaceBackground` is mounted once in the root layout. It uses batched SVG
stars, CSS gradients, slow drift, and reduced-motion support without creating a
WebGL context.

Authenticated routes mount `PlanetBackground` once inside `AppShell`. Because
`AppShell` belongs to the shared `(main)` layout, one Canvas persists while the
user navigates between application routes.

```text
SpaceBackground (root layout)
      ↓
AppShell
      └── PlanetPreferenceProvider
            ├── PlanetBackground (unmounted when the 3D checkbox is off)
            │     ├── non-rendering selected-asset cache gate
            │     └── one persistent Canvas
            │           └── PlanetSystem (one selected main body)
            │                 ├── PlanetModel
            │                 └── Moon orbit (Earth only)
            ├── navbar and sidebar
            └── route content / Settings selector
```

## Registry and selection

`modelsRegistry.ts` is the source of truth for selectable body identifiers,
labels, exact GLB paths, normalized body scale, position, orientation,
responsive composition, spin speed, restrained lighting, companion, and accent
theme. The selectable list contains Earth, Mercury, Venus, Mars, Jupiter,
Saturn, Uranus, and Sun. The Moon is a separate companion model and can only be
mounted when the selected registry entry declares `companion: "moon"`.

`PlanetPreferenceProvider` owns both the active theme/model selection and the
independent 3D visibility checkbox. It stores them under `social-network:planet`
and `social-network:planet-model-enabled`, applies the selected planet's theme
tokens even while its model is hidden, and synchronizes changes from another
tab. The app waits for both stored preferences before mounting the planet
layer, so a disabled model never creates a Canvas or starts a GLB request.
Settings consumes the same context, so there is no competing page-local state.

## Rendering and motion

`PlanetModel` is the low-level GLB renderer. It clones cached GLTF scenes before
model-specific changes, preserves authored PBR textures, retains the Earth
surface/cloud/atmosphere materials, keeps Saturn's ring transparency, and
restrains the authored emissive strength of Jupiter and Sun.

`PlanetSystem` composes every body through the same transform hierarchy:

```text
PlanetEntrance (one-time horizontal reveal)
  └── PlanetIdleMotion (subtle vertical drift)
        └── configured orientation / responsive scale
              ├── AxialRotation → selected PlanetModel
              └── OrbitingCompanion → Moon (Earth only)
```

Each motion layer owns a separate transform. The `useFrame` loops mutate refs
directly, allocate no objects per frame, and never update React state. A keyed
`PlanetSystem` replays the same full-scale cubic entrance for every body. In
reduced-motion mode all bodies settle immediately, continuous movement stops,
and the Canvas uses demand rendering.

## Loading and replacement

The selected asset gate calls `useGLTF` without mounting a Three object. The
current model stays visible while the requested GLB loads into the shared
cache. Only if that request is still the latest selection does the scene replace
the current keyed system, so rapid clicks cannot commit a stale body. No hidden
planet systems render, the Moon has its own Suspense/error boundary, and no
extra Canvas is created.
