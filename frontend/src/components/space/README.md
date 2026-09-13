# Shared space visuals

`SpaceBackground` is mounted once in the root layout, including authentication routes. It uses batched SVG stars from `starData`, CSS gradients, slow drift, and reduced-motion support. It does not create a Canvas or request model assets. It is unrelated to planet selection below and stays mounted regardless of which planet a user picks.

`PlanetModel` is the one low-level model renderer: it loads a single GLB inside a caller-owned R3F Canvas and Suspense boundary, and owns no camera, navigation, animation loop, or application state. `modelsRegistry` (`SPACE_MODELS`, `EARTH_MODEL_PATH`, `DEFAULT_MODEL_ID`, `findSpaceModel`) is the single source of truth for which models exist and their transforms — nothing else should hardcode a model id, name, or path. `earthMaterials` retains the Earth surface, cloud, and atmosphere material factory. Cached geometry/textures remain loader-owned, while cloned/custom materials are disposed on unmount.

The existing Earth scale calibration and Saturn export corrections are preserved in `PlanetModel`.

## Planet preference

The application no longer uses Solar System navigation, planet-specific routes, camera travel, GSAP planet transitions, or orbit navigation. Planet choice is now a plain user preference, not a navigation destination:

```text
Settings (/settings)
      ↓ setActivePlanet(id)
PlanetPreferenceProvider   — src/features/planet-preference/
      ↓ activePlanet
PlanetController           — src/components/space/PlanetController.tsx
      ↓ modelsRegistry lookup
PlanetModel
```

- **`features/planet-preference/storage/planetPreferenceStorage.ts`** — framework-free functions (`readPlanetPreference`, `writePlanetPreference`, `isValidPlanetId`, `subscribeToPlanetPreference`). Persists to `localStorage`; falls back to `DEFAULT_MODEL_ID` ("earth") if storage is unavailable or holds an id that isn't in `SPACE_MODELS`. Covered by `tests/planetPreference.test.mjs`.
- **`features/planet-preference/context/PlanetPreferenceProvider.tsx`** — the same `useSyncExternalStore` + storage-event pattern as `components/layout/sidebarContext.tsx`, exposing `{ activePlanet, isReady, setActivePlanet }` via `usePlanetPreference()`. Mounted once in the root layout, so the preference is available anywhere without being route-specific.
- **`components/space/PlanetController.tsx`** — the one reusable controller. `<PlanetController />` or `<PlanetController className={...} autoRotate />`. Reads the active id from `usePlanetPreference()`, resolves it through `modelsRegistry`, and renders exactly that one model — nothing is preloaded. It has no route awareness and no camera-travel/transition state.
- **`app/(main)/settings/page.tsx`** → **`features/settings/components/SettingsPage.tsx`** — the Appearance section where a user picks a planet from `SPACE_MODELS`. Selecting an option persists immediately and updates any mounted `PlanetController` without a page reload.

### Mounting boundary (why there's no global 3D layer yet)

`PlanetController` is currently mounted **only on `/settings`**, as a live preview of the selected model — it is not injected into the root layout or `AppShell`. Two reasons:

1. No page design yet calls for a persistent 3D layer, and adding one speculatively would be exactly the kind of always-on GPU cost this cleanup removed.
2. `tests/cleanup_smoke.py` asserts zero `.glb` network requests across the entire logged-in app flow (Home, Posts, Groups, Chat, Profile, Notifications, mobile viewport). Mounting a Canvas globally would load a model on every route and break that invariant.

`PlanetPreferenceProvider`, by contrast, *is* mounted globally in `app/layout.tsx` — it's plain state (no Canvas, no GPU, no network request), so any future feature that wants to render the chosen planet elsewhere (e.g. a home-page accent, a profile banner) can call `usePlanetPreference()` immediately without adding a second preference system. When that design exists, mount `<PlanetController />` at that specific spot — do not add a persistent app-wide scene.

### Performance notes

- Only the selected model loads; switching selections does not preload the rest of `SPACE_MODELS`.
- `PlanetController` caps device pixel ratio to `[1, 2]` and uses `frameloop="demand"` (renders once, no continuous RAF) unless `autoRotate` is set and the user has not requested reduced motion, in which case it switches to `frameloop="always"` for a slow (0.12 rad/s) rotation.
- No GSAP, no OrbitControls, no post-processing, no multiple cameras.

### Error handling

If a GLB fails to load, a small class-based boundary (`PlanetLoadBoundary`, inline in `PlanetController.tsx`) catches it, logs to the console, and retries once with Earth — without touching the user's saved preference or crashing the rest of the page. If Earth itself fails to load, the controller renders nothing rather than looping.

See `frontend/MODEL_ASSETS.md` for the preserved model inventory and the source-asset duplicate review.
