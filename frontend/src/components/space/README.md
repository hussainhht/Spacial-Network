# Shared space visuals

`SpaceBackground` is mounted once in the root layout, including authentication routes. It uses batched SVG stars from `starData`, CSS gradients, slow drift, and reduced-motion support. It does not create a Canvas or request model assets.

Authenticated routes add `PlanetBackground` once inside `AppShell`. Because `AppShell` belongs to the shared `(main)` layout, its Canvas and Earth model remain mounted while page content changes between Home, Groups, Messages, Profile, and other main routes.

```text
SpaceBackground (root layout)
      ↓
AppShell
      ├── PlanetBackground (one persistent Canvas)
      │     └── EarthSystem
      │           ├── PlanetModel (Earth)
      │           └── orbit root → PlanetModel (Moon)
      ├── navbar and sidebar
      └── route content
```

`PlanetModel` remains the low-level GLB renderer and owns no camera, navigation, animation loop, or application state. `PlanetBackground` owns the shared camera and restrained ambient/directional lighting. `EarthSystem` composes the Earth and Moon under one reveal/idle hierarchy while keeping Earth's axial rotation separate from the Moon's orbit. Both model paths come from `modelsRegistry` and resolve to the preserved optimized public GLBs. `earthMaterials` supplies the existing surface, cloud, and atmosphere materials.

`PlanetMotion` provides reusable entrance, idle, axial-rotation, and companion-orbit transform layers. The cubic ease-out entrance positions the complete planet system beyond the Canvas's right edge in its first rendered frame, then translates it to its unchanged resting position at full scale without overshoot. Earth rotates slowly, while the inclined Moon orbit remains independent. A future planet swap can replay the generic entrance by mounting it with the incoming planet's key; no selection or transition state exists yet.

The scene uses `useGLTF` caching, shares loaded source geometry, caps DPR at 2, and avoids post-processing and shadows. Its continuous frame loop performs only direct ref mutations with no per-frame object allocation. Reduced-motion mode settles all transforms immediately, disables continuous movement, and returns the Canvas to demand rendering. The Moon has its own Suspense/error boundary so its loading or failure does not remove Earth.

The Canvas is decorative, pointer-inert, and layered between the star background and application UI. A Suspense boundary keeps loading local to the scene, while the scene error boundary and the Canvas WebGL fallback leave the rest of the application usable if rendering fails.

See `frontend/MODEL_ASSETS.md` for the preserved model inventory and the source-asset duplicate review.
