# Universe navigation

Home (`/`) and Posts (`/posts`) are two places in one 3D scene, not two pages
with a scene each. Selecting Earth moves the camera through the solar system to
the same Earth, and the Posts UI appears once it arrives.

## Structure

```text
AppShell
├── UniverseNavigationProvider      state, camera rig, the one GSAP timeline
│   └── UniverseTransitionProvider  legacy (Groups); delegates / and /posts here
└── routeStage
    ├── PersistentUniverseScene     one Canvas, mounted on universe routes only
    │   └── SolarSystemScene
    │       ├── Planet × 7          registers its anchor node (Earth → EarthSystem)
    │       └── UniverseCameraController   the only camera writer
    └── #page-content
        ├── SolarSystemHome         Home UI   ─┐ useDestinationPresence
        └── PostsOverlay            Posts UI  ─┘
```

The scene sits behind the route content in the same box, above the route
boundary, so it survives the route change and the canvas never resizes.

## Files

| File | Owns |
| --- | --- |
| `destinations.ts` | Every camera destination, its route and label, per-aspect tiers, timings |
| `cameraPose.ts` | Pure pose maths: resolve a destination, blend two poses, the camera rig |
| `UniverseNavigationProvider.tsx` | `view` state, `navigate()`, the timeline, URL reconciliation |
| `useDestinationPresence.ts` | Showing a destination's UI only while the camera is there |
| `../components/UniverseCameraController.tsx` | Applying the rig to the camera every frame |
| `../PersistentUniverseScene.tsx` | Mounting the canvas across universe routes |

## A move

```text
0.00  view → departing        current UI fades out and goes inert
0.10  rig.progress 0 → 1      camera flies (linear progress, per-channel easing)
0.40  router.push             behind UI that is already invisible
1.80  view → arriving         camera settled; destination UI fades in
2.14  view → idle             input unlocked
```

GSAP only ever tweens `rig.progress`. The controller resolves both ends every
frame, so a body destination follows the body's live position: Earth keeps
orbiting the Sun, spinning, and carrying its Moon throughout. There are no
OrbitControls; nothing else writes the camera.

The URL is a consequence of a move, not its trigger. When it changes without a
move — Back, Forward, a link — the provider flies the camera to that route's
destination. A move interrupted by history starts again from the camera's
actual pose. A push that never lands is abandoned after 8 s, and the camera is
brought back into line with the URL.

Reduced motion replaces the flight with a fade of the scene, a cut while it is
dark, and a fade back in: the same destination, without watching it move.

## Adding a destination (e.g. Mars → Groups)

1. Add the id and route to `UniverseDestinationId` / `UniverseRoute`.
2. Add an entry to `UNIVERSE_DESTINATIONS` with `camera: { kind: "body", body:
   "mars", tiers }`. Calibrate the tiers against the real scene: from low
   angles, planets beyond the subject tend to sit directly behind it.
3. Render the destination's UI with `useDestinationPresence("mars-groups", …)`.
4. Move the route off the legacy provider's canvas (`isUniverseRoute` already
   excludes every route registered here).

The dock picks up the new body link automatically through `destinationForBody`.

## Future Posts modes

Posts cards stay DOM. For orbit mode, the scene should publish anchor positions
around Earth (projected to screen), and the cards position themselves from
them; nothing readable is rendered as a texture.
