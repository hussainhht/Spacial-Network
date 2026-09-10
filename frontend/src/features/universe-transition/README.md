# Home ↔ Groups transition

`UniverseTransitionProvider` lives inside the shared AppShell. It intercepts only
Home/Groups navigation through Next Link's `onNavigate`, preserving modified clicks
and ordinary links. Pages register their roots and existing orbit controllers;
scoped `data-universe-*` hooks identify the animated elements. No APIs or data
models are changed.

> **Universe Home v1 supersedes the two sections below at runtime.** The Earth
> cinematic and its Earth-anchor docking are retained but disabled; the homepage
> is the three-planet universe track. Read [Universe Home v1](#universe-home-v1)
> for current behavior. The next three sections describe the legacy path that
> stays isolated behind `navigation/homeMode.ts` for a later redesign, and the
> verification recorded when it was last active.

## Persistent Earth

A portal always targets the same imperative host. At rest on Home the host lives
in the original Earth layer, preserving post/Earth depth ordering. During travel
it moves into `UniverseTransitionLayer`. Reparenting this host does not change the
portal target or remount its Canvas. The layout's empty Earth marker retains the
original responsive CSS and supplies the exact return rectangle.

GSAP animates the real Three group’s position, rotation and scale. The canvas
carries 80% of screen travel and the group carries 20%, converted through the
current camera viewport. This retains the existing GLTF, materials, lighting,
camera and Bounds framing, without clipping the traveling planet or adding a
second renderer. Bounds does not refit around the temporarily collapsed object.
The renderer sleeps on Groups and is not mounted on unrelated routes.

## Timing

Each direction uses one timeline with a pause at route handoff. Forward draws
posts inward, moves/rotates Earth and collapses it around 1.36 seconds before
pushing Groups. Once the destination registers, the same energy point moves to
the measured YOU core, existing rings expand, nodes launch, and controls reveal.
Reverse collapses nodes and rings, pushes Home around 0.8 seconds, expands Earth,
returns it to the measured Home marker, and restores posts and controls.

The animation itself is roughly 2.2 seconds. Route/data readiness can extend the
energy hold. Data waiting is bounded at 1.8 seconds after navigation; an independent
8-second recovery timer ensures errors cannot permanently lock the interface.
A tiny tail after each GSAP pause prevents onComplete from firing before arrival.

Existing orbit loops are paused before transforms are read and resume after GSAP
restores their styles. The Home feed playhead survives navigation. History cancels
an active sequence, unrelated links remain normal, and resize completes navigation
without retaining obsolete measurements. Cleanup restores inert state and body
scroll. Keyboard focus moves to a destination heading/region.

Reduced motion uses a 140 ms exit and 160 ms entrance fade, with no globe travel.
DPR is capped during travel (lower on software WebGL), then restored. The hidden
Three group is also invisible: DOM opacity alone does not prevent WebGL work.

## Verification

Verified against the existing development API and records with headless Chrome:

- Five repeated round trips, same Canvas identity, exactly one Canvas.
- Real feed and membership data, direct Home/Groups refresh, direct Groups return.
- Back/Forward, repeated clicks without duplicate history entries, keyboard Enter.
- Home orbit playhead restoration, unlocked interaction and restored body overflow.
- Desktop and 390 px viewport, reduced motion, zero/one records and 12 group nodes.
- Sparse cases filter actual GET responses only in the test browser; no fake data
  or backend writes are introduced into the application.

Headless Chrome uses SwiftShader here; these checks do not establish 60 FPS on a
hardware-accelerated device. Production build and targeted lint/TypeScript checks
are run separately; repository-wide lint has existing unrelated failures.

## Universe Home v1

The homepage is now the three-planet universe track (Earth with its orbiting
Moon, Mars, Saturn). This provider keeps its persistent host and its Home/Groups
lifecycle, and additionally owns the home track's state.

### What the provider owns

`useUniverseHome(): UniverseHomeAPI` (same file, alongside
`useUniverseTransition()`) is the single authority for `activePlanetId`,
`selectedPlanetId`, normalized `homeProgress`, the scene readiness snapshot,
the shared reduced-motion preference and `isTransitioning`. No page, scene or
motion module may keep a second copy.

`reportHomeProgress` clamps to `[0,1]` and writes a ref on every rendered motion
tick; React state changes only when `round(p * (N - 1))` crosses a boundary, so a
full scrub costs two renders rather than one per frame. The active index is
derived, never stored twice. `homeProgress` is a distinct ref from the legacy
`homePosition`, which still carries the old feed's post playhead.

`selectPlanet` records an explicit destination choice and nothing else: no route
push, no zoom, no progress write, no input lock. A choice is stamped with the
route it was made on, so it reads as cleared once navigation settles elsewhere,
and it is dropped when a different planet becomes active.

Progress survives route changes because the ref lives in this provider, above
the route boundary — even on routes where the Canvas unmounts entirely.

### The payload and its host

The portal payload is `universe-home/scene/UniverseCanvas`, loaded through
`universe-home/navigation/UniverseCanvasHost` with `next/dynamic` and
`ssr: false`. That wrapper adds an error boundary above the scene's own: this
payload is portalled from a provider wrapping the entire shell, so a failed
chunk load would otherwise take the sidebar, navbar and every destination link
with it. The legacy `HomeEarth` payload is retained but never mounts while v1 is
enabled — two payloads would mean two WebGL contexts on one route.

Docking targets `[data-universe-viewport]` inside the registered `/` root, not
the old Earth anchor's parent, and waits for a non-zero measurement: the Canvas
sizes itself from that box, and a 0x0 parent would publish an unusable scene
handle. A ResizeObserver re-checks when the viewport is measured or resized,
including an animated sidebar collapse. The host parks back in
`UniverseTransitionLayer` before the homepage's DOM is removed, and a stale
registration cleanup can no longer pull it out of a newer registration.
`renderActive` is true only on Home, so Groups keeps the same Canvas node and
context but stops drawing. It is independent of reduced motion, which stops spin
and orbit inside the scene without blanking it.

### The v1 navigation guard

`navigate()` returns `false` for `/` and `/groups`, so the existing Next Links in
the sidebar route normally. The legacy Earth cinematic is written against the old
orbital feed's anchors, its `EarthHandle` and body scroll locks, none of which
describe a three-planet scene; its `animation.ts` choreography is left untouched
and isolated behind `navigation/homeMode.ts` for a later redesign rather than
rewritten. The switch is a module constant on purpose — a flag set on first
visiting Home would leave a direct `/groups` entry or a hard refresh on the
legacy path. Nothing sets `run.current` under v1, so the watchdog, inert state
and body-overflow mutations simply never engage on these routes; the retained
legacy path keeps all of those guarantees for a future re-enable.

This deliberately defers the old Home/Groups Earth-to-galaxy visuals. Client
navigation, modified clicks, Back/Forward and focus are unaffected.

### Extension points for a later transition

Nothing here implements a cinematic route transition, and scrolling never pushes
a route. The seams a later coordinator would use already exist:

- The registered `/` controller (`register('/', { root, pause, resume })`) locks
  and releases the scroll choreography without touching this provider.
- Each rig exposes a `transitionRoot` separate from the `scrollRoot` that motion
  owns, so a transition can move a planet without fighting the scrub. Transition
  roots are identity in v1.
- `selectedPlanetId` already records which destination was chosen, and
  `isTransitioning` already reads this provider's one coordinator.

A future sequence would pause the controller, center and zoom the chosen rig's
`transitionRoot`, push the configured route from `navigation/planetDestinations`,
reveal the destination and resume — reusing the persistent host rather than
adding a second transition machine.

## File inventory

Created in this directory: `UniverseTransitionProvider.tsx`,
`UniverseTransitionLayer.tsx`, `animation.ts`, `types.ts`,
`UniverseTransition.module.css`, and this README.

Universe Home v1 additionally reads from `features/universe-home/contracts.ts`
and `features/universe-home/navigation/` (`planetDestinations.ts`, `homeMode.ts`,
`homeProgress.ts`, `homeSelection.ts`, `useUniverseHomeState.ts`,
`UniverseCanvasHost.tsx`). `animation.ts` is unchanged.

Modified integration points:

- `src/app/(main)/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/TopNavbar.tsx`
- `src/components/space/HomeEarth.tsx`
- `src/components/space/Earth3D.tsx`
- `src/components/space/SpaceBackground.tsx`
- `src/features/posts/components/home/HomeOrbitalFeed.tsx`
- `src/features/groups/components/GroupsPageContent.tsx`
- `src/features/groups/components/galaxy/GroupGalaxy.tsx`
- `src/features/groups/components/galaxy/GroupStar.tsx`
- `src/features/groups/components/GroupPanels.tsx` (invitation animation hook only)

Existing uncommitted Groups styling and preview changes were preserved.
