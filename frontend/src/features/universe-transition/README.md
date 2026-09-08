# Home ↔ Groups transition

`UniverseTransitionProvider` lives inside the shared AppShell. It intercepts only
Home/Groups navigation through Next Link's `onNavigate`, preserving modified clicks
and ordinary links. Pages register their roots and existing orbit controllers;
scoped `data-universe-*` hooks identify the animated elements. No APIs or data
models are changed.

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

## File inventory

Created in this directory: `UniverseTransitionProvider.tsx`,
`UniverseTransitionLayer.tsx`, `animation.ts`, `types.ts`,
`UniverseTransition.module.css`, and this README.

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
