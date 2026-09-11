# Universe route transitions

`UniverseTransitionProvider` lives inside the shared AppShell. It intercepts
navigation between Home and the destinations that share the persistent scene,
through Next Link's `onNavigate`, preserving modified clicks and ordinary links.
Pages register their roots and existing orbit controllers; scoped
`data-universe-*` hooks identify the animated elements. No APIs or data models
are changed.

> **Universe Home v1 supersedes the two sections below at runtime.** The legacy
> Earth cinematic and its Earth-anchor docking are retained but disabled; the
> homepage is the three-planet universe track. Read
> [Universe Home v1](#universe-home-v1) and
> [The stage engine](#the-stage-engine) for current behavior. The next three
> sections describe the legacy path that stays isolated behind
> `navigation/homeMode.ts`, and the verification recorded when it was last
> active.

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
`selectedPlanetId`, the loop `phase`, the scene readiness snapshot, the shared
reduced-motion preference and `isTransitioning`. No page, scene or motion module
may keep a second copy.

`phase` is a plain mutable number, not state. It is the loop's continuous
position: GSAP tweens it, and each rig reads it inside `useFrame`. React learns
nothing while a move is running. `commitActivePlanet` fires exactly once, when
the timeline finishes and the arriving destination is genuinely in focus, so a
transition costs one render rather than one per frame.

`selectPlanet` records an explicit destination choice and nothing else: no route
push, no zoom, no phase write, no input lock. A choice is stamped with the route
it was made on, so it reads as cleared once navigation settles elsewhere, and it
is dropped when a different planet becomes active.

`setPlanetActivateHandler` is the channel for clicks that land on a planet. The
Canvas is portalled from this provider, so only the provider holds a stable
reference to it, but only the homepage knows whether a click should focus a
neighbour or open a destination. The provider passes a stable dispatcher into
the payload and the homepage installs the behaviour behind it, which keeps the
memoized payload from re-rendering whenever that behaviour is re-created.

The phase survives route changes because the ref lives in this provider, above
the route boundary — even on routes where the Canvas unmounts entirely.

### The payload and its host

The portal payload is `universe-home/scene/UniverseCanvas`, loaded through
`universe-home/navigation/UniverseCanvasHost` with `next/dynamic` and
`ssr: false`. That wrapper adds an error boundary above the scene's own: this
payload is portalled from a provider wrapping the entire shell, so a failed
chunk load would otherwise take the sidebar, navbar and every destination link
with it. The legacy `HomeEarth` payload is retained but never mounts while v1 is
enabled — two payloads would mean two WebGL contexts on one route.

Docking targets `[data-universe-viewport]` inside the registered root of
whichever composed route is current — `/`, `/posts` or `/groups` — not the old
Earth anchor's parent, and waits for a non-zero measurement: the Canvas sizes
itself from that box, and a 0x0 parent would publish an unusable scene handle. A
ResizeObserver re-checks when the viewport is measured or resized. The host parks
back in `UniverseTransitionLayer` before the departing page's DOM is removed, and
a stale registration cleanup can no longer pull it out of a newer registration.
`renderActive` covers every composed route: Mars is the Groups section's anchor
and has to keep turning there. It is independent of reduced motion, which stops
spin and orbit inside the scene without blanking it. Planet clicks are Home's
alone — `data-universe-docked` gates pointer events, so on Posts the cards and on
Groups the galaxy own the pointer.

### The v1 navigation guard

`navigate()` now serves both `/` → `/posts` and `/` → `/groups`, and the return
from Groups, through the stage engine below. The `UNIVERSE_HOME_V1_ENABLED`
guard is therefore reached only with v1 disabled: the legacy Earth cinematic is
written against the old orbital feed's anchors, its `EarthHandle` and body
scroll locks, none of which describe a three-planet scene, and its
`animation.ts` choreography is left intact behind `navigation/homeMode.ts`
rather than rewritten. The switch is a module constant on purpose — a flag set
on first visiting Home would leave a direct `/groups` entry or a hard refresh on
a different path. `exitScene` from that module is reused by the Groups return,
which is what it always described: group planets and orbit rings drawing into
the core.

### How the loop moves

The destination list is a ring, and each planet's place in the scene is a pure
function of one number: its offset from the focus, `index - phase`. That offset
is mapped onto a closed, tilted ellipse (`universe-home/motion/orbitPath.ts`)
whose front point is the focus:

| offset | slot     | where it sits                 |
| ------ | -------- | ----------------------------- |
| `0`    | active   | large, close, right of centre |
| `-1`   | previous | small, distant, upper left    |
| `+1`   | next     | small, distant, lower left    |
| `±N/2` | far side | smallest, furthest left       |

Because every coordinate comes from `cos`/`sin` of `2*pi*offset/N`, the path is
exactly periodic in `N`. Two things follow, and they are the whole design:

- A planet leaving the "previous" slot does not jump to the "next" slot. It
  keeps travelling round the far side, small and set back, and arrives there.
  There is no recycled slot to snap and no hidden element to reset.
- Adding or subtracting `N` from the phase reproduces every placement bit for
  bit, so `planetLoop.wrapPhase` renormalises after every step with nothing
  visible happening. The loop runs forever in both directions without float
  drift, index overflow or a reset frame.

`motion/usePlanetGestures` turns wheel, trackpad, touch and arrow keys into one
"advance by one" intent, accumulating normalised deltas against a threshold and
refusing to fire again on the decaying tail of a flick.
`motion/usePlanetLoop` holds the state machine (`idle` / `moving-forward` /
`moving-backward`), owns the single tween allowed to write the phase, and keeps
at most one queued direction so a held gesture cannot build a backlog.

There is deliberately no ScrollTrigger, no pin and no artificial page height.
The homepage is one locked pane that never exceeds the shell's scroll
container, so `#page-content` has nothing to scroll and no second scrollbar
appears.

### Opening a destination

A gesture never pushes a route: scrolling explores, and only a click on the
planet already in focus — or its destination link — opens a section.
`UniverseHome.openDestination` is the one entry point for both, so a section
cannot be entered two different ways, and it asks `navigate()` before falling
back to ordinary client navigation. The registered `/` controller
(`register('/', { root, pause, resume })`) locks and releases the loop for the
length of a move; `run.current` claiming its own destination is what makes a
second click a no-op rather than a second history entry.

## The stage engine

A **stage** is the scene's arrangement on a destination route. Each one has
exactly one subject — the planet that travels there and stays — and every other
body leaves. `navigation/planetDestinations.ts` owns that table
(`UNIVERSE_STAGE_PLANETS`: Posts → Earth, Groups → Mars) and derives each route
from `PLANET_DESTINATIONS`, so a stage and its destination link cannot disagree.

Two mutable cells carry a move, and neither costs a render:

| cell          | meaning                                      | written by       | read by    |
| ------------- | -------------------------------------------- | ---------------- | ---------- |
| `stage`       | 0 = home loop, 1 = the destination           | `useStageTravel` | `useFrame` |
| `stageTarget` | which destination `stage` is heading towards | `useStageTravel` | `useFrame` |

`stageTarget` is written only on departure and deliberately left alone on the
way back, so a return is an interpolation of the same two compositions the
departure was: the bodies retrace the curve they arrived on instead of snapping
to another destination's geometry half way home.

`PlanetRig` reads both inside its frame callback and does one of three things
per body: the subject travels to the destination anchor; on Groups every other
body spirals into the core star (`orbitPath.spiralToPoint`, staggered by
`ABSORB_DELAY` so the Moon leads, then Saturn, then Earth); on Posts they
withdraw along their depth axis. GSAP never touches a transform the frame loop
writes, which is why every planet keeps spinning and the Moon keeps orbiting
throughout.

`travelRun` in the provider is the single engine. Direction-specific
choreography is one `choreograph` callback — there is no second transition
machine for Mars. `openStage` adds the core-star glow, which lives in the fixed
transition layer above both routes, so the star is already reacting when the
galaxy mounts behind it; `returnHome` runs `exitScene` and contracts the same
glow.

### Where the Groups composition comes from

`universe-home/scene/groupsStage.ts` is the single source of Mars's anchor, the
core star and the galaxy diameter, as a pure function of the docked viewport's
pixel box — the same contract as `postsStage.ts`, and for a stronger reason. The
absorption is choreographed on Home, _before_ the Groups DOM exists, so the
target cannot be measured; it is predicted, and the arriving page honours the
same numbers. `useGroupsComposition` publishes them onto the pane as
`--groups-star-*`, `--groups-galaxy` and `--groups-mars-*`, and the galaxy
positions its core from those. Verified equal to the rendered core within ~3px
at every tier.

Below 1000px the galaxy falls back to a flowing grid, where the core sits a
fixed pixel distance under the controls rather than at a fraction of the pane —
`starY` is a discriminated union for exactly that reason.

### Shell layout

`components/layout/shellLayout.ts` decides which chrome a route gets.
`universe` is navbar-only: `/`, `/posts` and everything under `/groups`. The
sidebar is not rendered and its column is not reserved — `mainAreaFull` zeroes
both the margin and `--sidebar-width`, so nothing downstream can lay itself out
around a panel that is absent. Every other route keeps the original sidebar
shell untouched. Routes move between the two lists as their navbar-only
replacement lands; the last move deletes the branch.

The navbar's sidebar-toggle slot carries a `← Universe` button on universe
routes. It asks `navigate("/")` first and falls back to an explicit
`router.push("/")` — never `router.back()`, which can point somewhere unrelated.

## File inventory

Created in this directory: `UniverseTransitionProvider.tsx`,
`UniverseTransitionLayer.tsx`, `animation.ts`, `types.ts`,
`UniverseTransition.module.css`, and this README.

Universe Home v1 additionally reads from `features/universe-home/contracts.ts`
and `features/universe-home/navigation/` (`planetDestinations.ts`, `homeMode.ts`,
`planetLoop.ts`, `homeSelection.ts`, `useUniverseHomeState.ts`,
`UniverseCanvasHost.tsx`). The loop itself lives in
`features/universe-home/motion/` (`orbitPath.ts`, `planetLoop` consumers
`usePlanetLoop.ts` and `usePlanetGestures.ts`, `wheelInput.ts`, and the
composing `useUniverseHomeMotion.ts`). `animation.ts` gains only an exported
`localDelta`; its choreography is unchanged.

The Mars → Groups stage adds
`features/universe-home/scene/groupsStage.ts`,
`features/groups/components/galaxy/galaxyReveal.ts`,
`features/groups/components/galaxy/useGroupsComposition.ts` and
`components/layout/shellLayout.ts`.

Modified integration points:

- `src/app/(main)/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/TopNavbar.tsx`
- `src/components/space/HomeEarth.tsx`
- `src/components/space/Earth3D.tsx`
- `src/components/space/SpaceBackground.tsx`
- `src/features/posts/components/orbit/OrbitalPostsFeed.tsx`
- `src/features/groups/components/GroupsPageContent.tsx`
- `src/features/groups/components/galaxy/GroupGalaxy.tsx`
- `src/features/groups/components/galaxy/GroupStar.tsx`
- `src/features/groups/components/GroupPanels.tsx` (invitation animation hook only)

Existing uncommitted Groups styling and preview changes were preserved.
