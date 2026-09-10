# Shared contract — v1

This is the agreed implementation interface, not a claim that these exports exist. Agent 3 creates the types in `frontend/src/features/universe-home/contracts.ts` and route config in `navigation/planetDestinations.ts`. Changes require a request and consumer acknowledgment, recorded by Agent 4. No shared barrel file is necessary: import the exact module.

## Identity and configuration

```ts
import type { Group } from "three";
import type { Ref } from "react";

export type PlanetId = "earth" | "mars" | "saturn";
export type PlanetDestination = {
  id: PlanetId;
  label: string;
  sectionLabel: string;
  href: string;
};
export type PlanetRigHandle = {
  id: PlanetId;
  transitionRoot: Group;
  scrollRoot: Group;
};
export type UniverseSceneHandle = {
  rigs: ReadonlyMap<PlanetId, PlanetRigHandle>;
  // World units measured at z=0 using the current R3F camera/viewport.
  viewportWidth: number;
  viewportHeight: number;
  // Uniform center-to-center spacing; accounts for rings and Moon orbit.
  spacing: number;
  invalidate: () => void;
};
export type UniverseCanvasProps = {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  renderActive: boolean;
  reducedMotion: boolean;
  onSceneReady: (scene: UniverseSceneHandle | null) => void;
};
export type HomeMotionController = {
  pause: () => void;
  resume: () => void;
  goToPlanet: (id: PlanetId) => void;
};
export type HomeMotionOptions = {
  root: HTMLElement | null;
  viewport: HTMLElement | null;
  scroller: HTMLElement | null;
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  enabled: boolean;
  progressRef: { current: number };
  onProgress: (normalizedProgress: number) => void;
};
export type UniverseHomeAPI = {
  activePlanetId: PlanetId;
  selectedPlanetId: PlanetId | null;
  homeProgress: { current: number };
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  isTransitioning: boolean;
  reportHomeProgress: (progress: number) => void;
  selectPlanet: (id: PlanetId | null) => void;
};
```

`planetDestinations.ts` exports `PLANET_DESTINATIONS: readonly PlanetDestination[]`, ordered Earth → Mars → Saturn, provisionally mapped Earth/Posts `/posts`, Mars/Groups `/groups`, Saturn/Profile `/profile`. It also exports `PLANET_ORDER: readonly PlanetId[]` derived from that array. UI strings and destinations come from this configuration. No Moon or Messages destination yet. Extending this union and configuration later is an explicit small change, not a rewrite. Agent 1's visual configuration references DEV_MODELS by ID (including Moon as a satellite), contains only scale/orbit/spin/framing settings, and imports destination order; it must not reproduce route config or asset URLs.

## Public modules and wiring

- Agent 1: `scene/UniverseCanvas.tsx` default-exports `UniverseCanvas(props: UniverseCanvasProps)`. It is a client component with a stable outer div ref and one Canvas; Agent 3 dynamically imports it with SSR disabled from a client module. It emits a complete scene handle once all three roots exist, a new handle snapshot when measured dimensions/spacing change, and null on teardown. Keep Group identities stable on resize. No per-frame handle emission. Root readiness need not wait for GLBs: suspend model children inside stable rigs. Failed assets must not erase DOM navigation.
- Agent 2: `motion/useUniverseHomeMotion.ts` exports named `useUniverseHomeMotion(options: HomeMotionOptions): HomeMotionController`. Methods are stable and null-safe before ready; cleanup belongs to the hook. Use agreed Group handles; no GLB dependency.
- Agent 3: existing `UniverseTransitionProvider.tsx` additionally exports named `useUniverseHome(): UniverseHomeAPI` backed by that same persistent provider. It stores scene readiness from onSceneReady and exposes it to Agent 4. Keep `useUniverseTransition()`'s existing signatures and `SceneRegistration` compatible for sidebar and Groups consumers. Types may be implemented internally in Agent 3's navigation directory, but state has one provider owner.
- Agent 4: `UniverseHome.tsx` default-export, mounted by `(main)/page.tsx`. It renders the home section, viewport and DOM controls, invokes the motion hook, and reads useUniverseHome. It resolves `#page-content` after mount as `scroller`; callback refs or equivalent state must make DOM readiness observable so the hook reruns once elements mount.
- Agent 4 registers `/` exactly once through existing `register('/', {root, pause, resume})`, using the motion controller methods. Unregister on cleanup. New section has `data-universe-scene="home"`; viewport has `data-universe-viewport`. Agent 3 docks the stable portal host **inside this viewport**, not via the old Earth anchor's parent. The viewport must have usable measured width/height before docking. Agent 3's stage class fills its container; Agent 4 owns container dimensions. No React children controlled by the homepage inside the imperative portal host.
- Retain existing `/groups` registration from GroupGalaxy unchanged. Do not register an additional home root from old HomeOrbitalFeed; it is no longer mounted on `/`.

## State ownership and persistence

The existing persistent provider (Agent 3) is the only authority for active ID, selected ID, normalized home progress and transition status. Initial active ID Earth, selected ID null, progress 0. `reportHomeProgress` clamps progress to [0,1], updates the ref every motion tick, and changes React active state only when `round(progress * (N-1))` changes. Index is derived, never a second stored state. GSAP's local tween playhead is an animation driver, not a competing UI state store. Agent 1 never stores active/selected state. Agent 4 never stores another active index.

Use the rendered scrub playhead for reportHomeProgress so labels match visible position, not the scroll target ahead of smoothing. Agent 2 reads progressRef on mount/resize and restores both scroll offset and rig transforms before ordinary updates overwrite the saved value. Persist normalized progress across route changes inside the provider. Preserve the old `homePosition` ref's post-playhead semantics for existing consumers; do not reuse it for planet progress.

`selectPlanet` records an explicit destination choice; it does not push a route, run a zoom, change progress, or lock input. Clear stale selection when active ID changes to a different destination, and after route navigation settles. DOM focus controls call `goToPlanet`; a standard Next Link to the configured destination may call selectPlanet on ordinary navigation. Modified clicks retain browser behavior. Planet mesh click handling and a new route-transition phase machine are not required.

Retain existing UniverseTransitionState/SceneRegistration/EarthHandle types for old code. Do not reinterpret `idle-groups` as a universal destination or derive active planet from those legacy phases. `isTransitioning` reads the existing provider; no second transition boolean or new seven-phase implementation. A future transition can pause the registered motion controller, operate on a rig's transitionRoot, push a route and resume using the existing persistent host. These are extension points only.

## Transform contract

```text
EarthTransitionRoot (Agent 3 future transition; identity in v1)
└── EarthScrollRoot (Agent 2 position.x only)
    └── EarthSystem (Agent 1 static scale/framing)
        ├── EarthRotationRoot (Agent 1 useFrame axial spin)
        │   └── EarthPlanetModel
        └── MoonOrbitRoot (Agent 1 orbital angle)
            └── MoonOffset (Agent 1 static local orbital radius)
                └── MoonRotationRoot (Agent 1 axial spin)
                    └── GenericPlanetModel(moon)
Mars/SaturnTransitionRoot
└── ScrollRoot
    └── RotationRoot → reused model (static normalization groups allowed)
```

Every destination is a sibling rig. Moon belongs under Earth's scroll/transition roots but outside Earth's axial rotation. Agent 1 configures camera/lights/static model transforms and spins only inner roots. Agent 2 owns every destination ScrollRoot.position.x, including initial positioning and resize restoration; Agent 1 must not supply reactive `position` props that reset it. Agent 3 must not use legacy dock/animation code to mutate a new scroll or rotation root. Transition roots remain identity in this milestone. No camera animation or fit-all Bounds around the spread-out track.

## Scroll and framing

For N destinations, normalized rendered progress p, destination index i and measured spacing S:

`x(i,p) = (p * (N - 1) - i) * S`

At p=0: Earth 0, Mars -S, Saturn -2S. At p=.5: Earth +S, Mars 0, Saturn -S. At p=1: Earth +2S, Mars +S, Saturn 0. World positive x is screen right. Reverse scrolling reverses the sequence. Snap stops are `i/(N-1)`; guard N<=1. Snap chooses nearest stop (avoid velocity/directional bias); it must remain interruptible by fresh input.

Use normal vertical scroll on `#page-content`, pin the viewport within the home root with proper pin spacing. Agent 4's root permits vertical content growth and uses a measured pane-height viewport; do not reuse `.home`/`.homeContent` overflow-hidden wrappers that clip the pin spacer. Agent 2 owns pin spacer/travel duration and observes scroller/viewport resize (including animated sidebar collapse). Batch refreshes; preserve progress and rebuild only owned tweens. Never globally kill triggers. No native horizontal scroll requirement or wheel preventDefault hijacking.

Agent 1 measures the R3F viewport at the rig plane, fits active bodies prominently to the available pane and calculates S large enough to separate the Moon orbit and Saturn ring envelopes. Avoid fitting the entire track into view. Use transparent Canvas, shared SUN_POSITION, capped DPR, stable rigs and zero allocations/state updates per frame. Disable unnecessary drawing off Home; reduced-motion discrete changes explicitly invalidate demand rendering.

## Reduced motion, readiness and teardown

Reduced motion is observed once by Agent 3, passed to scene and motion. Stop intrinsic spin/orbit; Agent 2 bypasses smooth scrub and animated snap, applies discrete nearest-stop changes and supports immediate goToPlanet. Keep vertical and keyboard access; no input trap. DOM destination links remain usable before WebGL loads or if it fails. No automatic route push on scroll/snap.

If inputs are missing, Agent 2 returns safe no-op methods and creates no trigger; it sets up when DOM and scene are ready. Agent 3 parks host before home DOM removal, hides/sleeps the Canvas on Groups, and retains its identity for Home ↔ Groups. Preserve the existing policy of not mounting this universe renderer on unrelated routes/dev labs; returning from those may remount GPU resources while provider progress survives. Full cross-all-routes GPU persistence is deferred. Cleanup nulls scene handles, reverts only owned GSAP context, removes observers/listeners and restores any modified scroll/inert styles. No stale cleanup may clear a newer registration.

## Existing cinematic transition compatibility decision

The legacy Earth-to-galaxy transition depends on old feed anchors, EarthHandle, and body scroll locks. It must not run against the new planet homepage. Agent 3 adds a narrowly scoped v1 mode guard so `navigate('/')` / `navigate('/groups')` return false for ordinary Home/Groups navigation under the new homepage mode; existing Next Links then navigate normally. Keep old implementation isolated for compatibility, do not expand or rewrite its choreography. Activate this guard and the portal payload adaptation before integration testing the new home. Direct refresh and Groups → Home must use the same mode, not a flag set only after visiting Home. No second HomeEarth Canvas may coexist with UniverseCanvas. This deliberately defers the old visual Home/Groups animation while preserving functional client navigation and the infrastructure for its later redesign.
