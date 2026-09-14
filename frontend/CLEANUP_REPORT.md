# Frontend cleanup — September 13, 2026

## Audit before changes

The working tree was clean. Inspected all frontend routes, source imports (including dynamic imports), providers, shared layout, CSS, GSAP consumers, Canvas owners, and GLB inventories before removal. No backend or Git state changes are part of this cleanup.

| Classification | Finding | Decision |
| --- | --- | --- |
| REMOVE | `features/solar-system/` (26 files) | Active Home/Posts camera navigation, route/body mappings, orbit simulation, lighting, scene loaders, and overlays belong to the abandoned design. |
| REMOVE | `features/universe-home/` (31 files), `features/universe-transition/` (7 files) | Earlier competing scene, canvas reparenting, gesture loops, stage coordinates, Earth handles, route registration, timelines, and their dedicated harnesses. Both navigation providers were still mounted in AppShell. |
| REMOVE | `features/planets-dev/`, `app/(main)/dev/`, `HomeEarth`, `Earth3D` | Alignment lab, model viewers, duplicate canvases, and transition-only Earth wrappers. |
| REFACTOR | Home, Posts, Groups | Reuse the real PostFeed and existing group data/hooks/cards/previews. Remove placeholder Posts, orbital cards, Mars anchors, and group orbit choreography. |
| REFACTOR | AppShell, AppSidebar, TopNavbar, SpaceBackground | Remove route interception, readiness gates, route-dependent chrome, persistent 3D layers, and route-specific sky variants. Reuse the existing sidebar for ordinary navigation. |
| KEEP | WebSocketProvider, NotificationProvider, GroupStateSync, GroupsSearchProvider | Required application state, realtime, notifications, and group search. |
| KEEP / REFACTOR | DevPlanetModel, modelsRegistry, earthMaterials | Retain model loading, normalization, authored materials/rings, and Earth shaders as a route-independent, dormant rendering utility; remove development naming/preview metadata. |
| KEEP | SpaceBackground, starData, shared theme and feature CSS | One lightweight SVG/CSS starfield, haze, and reduced-motion support. |
| REMOVE | GSAP | Every consumer is in the removed scenes, orbital feed, galaxy choreography, or galaxy preview animation. Preserve the preview itself with ordinary UI behavior. |
| KEEP | Three.js, React Three Fiber, Drei | Intentionally retained for the reusable model renderer and future single-planet visual feature. No scene or selection preference will be implemented here. |
| UNCERTAIN | Source/export models under `3d/` | Preserve all model assets; report hashes, sizes, and duplicate candidates instead of deleting source material. |

All five Canvas owners were identified: Earth3D, PlanetStage, SolarSystemCanvas, UniverseCanvas, and the development ModelViewer. None is a clean independent global visual scene.

Baseline lint: **14 errors, 8 warnings**, including existing hook-state issues in social features. No frontend test command is defined; existing test harnesses cover the removed universe implementation only.

## Completion details

Final changes, asset inventory, and validation results will be recorded below after verification.
