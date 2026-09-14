# Shared space visuals

`SpaceBackground` is mounted once in the root layout, including authentication routes. It uses batched SVG stars from `starData`, CSS gradients, slow drift, and reduced-motion support. It does not create a Canvas or request model assets.

Authenticated routes add `PlanetBackground` once inside `AppShell`. Because `AppShell` belongs to the shared `(main)` layout, its Canvas and Earth model remain mounted while page content changes between Home, Groups, Messages, Profile, and other main routes.

```text
SpaceBackground (root layout)
      ↓
AppShell
      ├── PlanetBackground (one demand-rendered Canvas)
      │     └── PlanetModel (Earth only)
      ├── navbar and sidebar
      └── route content
```

`PlanetModel` remains the low-level GLB renderer and owns no camera, navigation, animation loop, or application state. `PlanetBackground` owns the shared camera and restrained ambient/directional lighting. The Earth model path comes from `modelsRegistry` and resolves to the optimized `public/models/planets/earth-final.glb` asset. `earthMaterials` supplies the existing surface, cloud, and atmosphere materials.

The scene uses `useGLTF` caching, shares the loaded source geometry, and disposes only its custom cloned materials. Its DPR is capped at 2 and `frameloop="demand"` prevents a continuous render loop. There is no post-processing, orbit control, page transition, rotation, or planet-selection state.

The Canvas is decorative, pointer-inert, and layered between the star background and application UI. A Suspense boundary keeps loading local to the scene, while the scene error boundary and the Canvas WebGL fallback leave the rest of the application usable if rendering fails.

See `frontend/MODEL_ASSETS.md` for the preserved model inventory and the source-asset duplicate review.
