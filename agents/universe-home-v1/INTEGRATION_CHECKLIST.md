# Integration acceptance and evidence

Agent 4 owns this checklist. All items start unverified. Record command/action, viewport/renderer, result and evidence location for each completed group. Source inspection alone does not establish visual smoothness. Use PASS / FAIL / BLOCKED with reasons, never silently check a skipped item.

## Architecture

- [PASS] Exactly one universe WebGL Canvas on Home; SpaceBackground reused as SVG/CSS. `canvasCount === 1` in every sample, all three viewports.
- [PASS] Same Canvas node/context survives repeated Home <-> Groups and is hidden/asleep on Groups. 5 rounds: `document.querySelector("canvas") === originalCanvas` and `getContext("webgl2") === originalContext` both true; on Groups `frameloop === "never"`, `pinSpacers === 0`.
- [PASS] Universe renderer does not coexist with dev/planets or dev/3d Canvas. Portal renders only on `/` and `/groups`; production build emits both dev routes.
- [PASS] Persistent host parks before homepage unmount, mounts into data-universe-viewport on return. Canvas identity preserved across all 5 rounds with no page errors.
- [PASS] No duplicate Home registration, old orbital feed ScrollTrigger or active/selected/progress state. `pinSpacers === 1` on Home and `0` off Home across 5 rounds; `mainCount === 1`.
- [PASS] Existing provider APIs still compile for Sidebar, Groups, and unmounted legacy feed. Whole-project `tsc --noEmit` exit 0; production build exit 0.
- [PASS] Legacy Earth cinematic is guarded both ways, including direct Groups refresh -> Home. Observed `data-universe-state` values across Home->Groups were only `idle-home`/`idle-groups`; no `home-to-groups`/`groups-to-home`, no `data-running`/`data-waiting`, `document.body.style.overflow` stayed `""`.
- [PASS] Future transition can pause motion and target separate transitionRoot; no new zoom/route phase sequence implemented. Rig snapshots show `transitionRoot` at identity; only `*-ScrollRoot.position.x` changes.

## Scene and visual behavior

- [PASS] Earth/Moon move together; Moon orbits independently of Earth's axial rotation. `EarthRotationRoot` and `MoonOrbitRoot` rotation.y both advance between samples and are separate nodes; Moon sits under Earth's scroll root.
- [PASS] Earth, Mars, Saturn and Moon rotate slowly using delta time; rotations stop for reduced motion. Live reduced-motion toggle froze all five rotation roots (identical rotation arrays across two samples 500 ms apart).
- [PASS] Model normalization/materials/textures preserved; Saturn rings not clipped. Geometry/texture counts settle at 47/7 and stop growing; screenshots at 1440/768/390 captured.
- [PASS] Active planet fills the available pane without hiding controls or navbar. Measured world width/height/spacing match Agent 1's published table (1196x836 -> spacing 14.241; 318x740 -> 4.251). Screenshots in `/tmp/universe-home-agent-4/`.
- [PASS] One lighting setup, transparent Canvas; no added starfield.
- [PASS] useFrame creates no objects/state updates each frame; no mutation of shared GLTF cache. `gl.info.memory` bounded across 5 route round trips (geometries 47, textures 7, flat).
- [PASS] Only Agent 2 writes ScrollRoot.x; transition roots identity; camera does not fit the whole track.

## Motion and resize

- [PASS] Normal vertical scroll acts on #page-content with a correctly sized pin spacer. Spacer height = 3x pane height (2508/836, 2880/960, 2220/740); `maxScroll` = 2x pane height.
- [PASS] Earth center -> Earth right/Mars from left -> Mars center -> Saturn from left -> Saturn center. Measured x matches `x(i,p) = (p*(N-1)-i)*S` exactly at p=0 and p=0.5, and at p=1 after settling.
- [PASS] Reverse scrolling restores the reverse sequence; no horizontal scrollbar. Scrolling to the bottom then back to the top returned exactly `{earth:0, mars:-S, saturn:-2S}`; `overflowX === false` everywhere.
- [PASS] Nearest snap settles at 0, .5, 1, is interruptible, does not trap input. Boundary checks at 0.24/0.26/0.74/0.76 each settled on the nearest planet with the active rig within 0.03 world units. `inertia:false`, `directional:false` in source.
- [PASS] Active label tracks rendered scrub position. Verified while on Home. **See A4-007 for the label after a route round trip.**
- [PASS] Missing refs/model loading create no premature trigger; readiness eventually enables motion.
- [FAIL] Sidebar expanded/collapsed, resize and orientation preserve normalized progress and recompute world spacing. Spacing half PASSES (1196->1440 px recomputed 14.241 -> 16.227). Progress half FAILS: collapsing the sidebar with Mars active reset the track to Earth at progress 0. Same root cause as A4-007.
- [PASS] StrictMode/remounts and five repeated route round trips produce no duplicate triggers/listeners/observers. `pinSpacers` never exceeded 1; no page errors across 5 rounds.
- [PASS] Cleanup reverts only owned context; pin spacers disappear after leaving Home. `pinSpacers === 0` on Groups every round.
- [FAIL] Return to Home restores prior planet/progress before a default update overwrites it. **A4-007** — reproducible in all 5 rounds.

## Navigation, accessibility and resilience

- [PASS] DOM controls have accessible names and visible focus; keyboard reaches every destination without Canvas pointer input. Focus ring computed non-`none`, non-zero width; Enter on a focus button changed the active planet.
- [PASS] Next Links route to /posts, /groups, /profile without full refresh. A page-scoped marker survived every navigation, proving client-side routing. `/posts` then redirects to `/login` because the browser is unauthenticated — that is the app's own auth behaviour, not a milestone defect.
- [PASS] Scrolling and snapping never automatically push a route; Moon has no destination. URL stayed `/` through all scrub/snap checks.
- [PASS] Existing sidebar links/toggle and navbar menus/notifications remain functional; skip link still reaches content. Navbar user menu opened above the Canvas and returned focus on Escape.
- [PASS] 390x844, 768x1024 and 1440x900 tested, plus sidebar collapsed.
- [PASS] Reduced motion at startup and when changed live stops orbit/spin and avoids smooth scrub/snap; all destinations remain accessible. `frameloop === "demand"`, focus is immediate, all three links present.
- [PASS] Simulated missing GLB/WebGL failure leaves useful DOM navigation, no permanent lock. Aborted `mars-final.glb` and a null WebGL context each still rendered all 3 destination links with `body.style.overflow === ""`.
- [PASS] Back/Forward, repeated clicks, direct route loads and navigation during scrub leave no stuck overflow or inert state. `inert` list empty, `bodyOverflow === ""` in every sample.
- [PASS] No backend/API/auth/feed data changes. Only pre-existing unauthenticated 401s from `/api/notifications*`, which the navbar requests on every route.

## Checks and evidence

- [PASS] Baseline lint/type results captured and pre-existing failures separated (below).
- [PASS] Owners ran ESLint on changed paths (Agents 1/2/3 logs; Agent 4 re-verified).
- [PASS] `./node_modules/.bin/tsc --noEmit --incremental false` from `frontend` — exit 0, whole project.
- [FAIL, pre-existing] `npm run lint` — exit 1, 13 errors / 7 warnings. **None are in this milestone.** All are in `providers/WebSocketProvider.tsx`, `features/chat/**`, `features/groups/**`, `features/profile/**`, `features/comments/**`, `components/layout/sidebarContext.tsx`, `app/(auth)/login/page.tsx`. Zero problems in `universe-home/**`, `universe-transition/**`, `(main)/page.tsx` or `AppShell*`.
- [PASS] `npm run build` — exit 0, all 17 routes generated including `/`. Run with the dev server stopped, so nothing raced `.next`.
- [PASS] Motion checks cover p=0/.5/1, nearest-stop boundaries, N<=1 guard, restoration and cleanup. Agent 3's `navigationHarness` 21/21 via `node --test`; Agent 2 reports 57/57; Agent 4's browser audits above.
- [PASS] Browser evidence includes console/runtime errors, viewport dimensions, Canvas count/identity, trigger lifecycle and responsive screenshots. Artifacts in `/tmp/universe-home-agent-4/`.
- [PARTIAL] DPR capped and off-home rendering verified: `dpr === 0.5` (software-renderer path), `frameloop === "never"` off Home, draw calls 3-41, memory flat over 5 round trips. **Hardware 60 FPS is explicitly unverified** — the only GPU available is SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`).
- [PASS] No global transform churn, duplicate scene systems or temporary production imports. Instrumentation used during diagnosis was removed; harness files stay under `integration/` and are never imported by production.
- [PASS] All four owners report no Git mutations; the index error remains user-owned and unrepaired.
- [PASS] STATUS, REQUESTS, ownership and decisions reflect the final implementation; the two unresolved items have an owner and a reproduction.

## Validation procedure

Agent 4 alone manages app processes and final broad checks. Inspect available tooling first; use `npm run dev` from frontend for the app and the webapp-testing skill's existing helpers if applicable. Do not install browsers/dependencies, invent login credentials or change backend records merely to make tests pass. Use an existing authorized session if available; report authentication/API/tooling blockers and continue source/type/layout checks that are possible. Keep test artifacts under the assigned integration directory or `/tmp/universe-home-agent-4/` and reference their paths. A running WebSocket may make networkidle unsuitable: wait for explicit page/scene readiness with bounded timeouts.

For final build: request freeze, receive each owner's acknowledgment, stop only an Agent-4-owned dev process, run checks sequentially, then restart if useful. Do not kill other users' servers. If an existing server cannot be coordinated, record build conflict rather than racing it.

## Evidence log

Not run — planning-only package. Add dated entries during implementation, including blocked checks.

### 2026-09-10 pre-activation baseline (Agent 4)
- Existing user dev server port 3000/PID 317478; backend port 8080. No server started/stopped by Agent 4. Build blocked until existing service owner coordination (A4-002) and explicit final edit freeze (A4-004).
- Cached Node Playwright and Chromium available; Python Playwright unavailable. No package/browser installation.
- `/` old feed redirected to `/login` on 401 posts; notification APIs 401. `/tmp/universe-home-agent-4/baseline.png`.
- Direct `/groups` retains signed-out page shell, main count 1, groups root 1 and no pageerror: `/tmp/universe-home-agent-4/groups-baseline.png`. Authenticated content checks blocked (A4-003); shell/persistence checks remain possible.
- Agent 4 composition/UI/harness targeted ESLint PASS (exit 0). Agent 1 scene lint PASS; Agent 2 reports motion lint/type and 57/57 local assertions. These are not final broad checks or visual/lifecycle proof.
- Accessibility scanner isolated nav warnings for missing main/skip link are component-boundary false positives: UniverseHome supplies main and AppShell supplies skip link. Integrated keyboard/focus/contrast still pending.

### 2026-09-10 Agent 4 takeover — integrated runtime evidence

Environment: existing user dev server (Next 16.3.2, port 3000, PID 317478) used read-only for all browser checks; stopped only at the end, with the user's explicit authorisation, so `npm run build` would not race `.next`. **The dev server is not running now — restart `npm run dev` from `frontend` when you want it back.** Backend (port 8080) was never touched.

Tooling: Playwright 1.63.0 from the existing npx cache (`~/.npm/_npx/e41f203b7505f1fb`), matching the cached chromium-1243. Nothing was installed. The 1.55.1 cache is unusable here because it wants chromium-1193.

Harnesses (all Agent 4 owned, none imported by production):
- `integration/browser-audit.mjs` — 3 viewports x 5 focus steps, sidebar collapse, reduced motion, links.
- `integration/lifecycle-audit.mjs` — 32 checks: 5 Home<->Groups rounds, Back/Forward, modified click, navbar, keyboard, snap boundaries, reduced motion, missing-GLB / no-WebGL / reduced-startup resilience. Settle waits were raised from 2300 ms to 3500 ms after measuring that the software renderer needs about 2 s to converge; the earlier value produced false "Saturn never centres" readings.
- `integration/scroll-extent-audit.mjs` — new: proves the scroller can reach progress 1.

Result: **27 PASS / 5 FAIL, no page errors, no blockers.** The 5 failures are all the same defect, A4-007.

Corrected earlier finding: the first audit appeared to show Saturn resting 10% of a spacing left of centre at 1440x900. Re-measuring with longer settles showed `goToPlanet("saturn")` and a direct scroll to the bottom both reach `saturn.x === 0` exactly by 2000 ms. That was a measurement artefact of the software renderer, **not** a motion defect, and no request was filed against Agent 2 for it.

Artifacts: `/tmp/universe-home-agent-4/` — `browser-audit.json`, `lifecycle-audit.json`, `scroll-extent-audit.json`, `converge.txt`, and screenshots (`1440-earth.png`, `1440-saturn.png`, `768-*`, `390-*`, `*-collapsed.png`, `extent-*-bottom.png`, `missing-mars.png`, `no-webgl.png`, `reduced-startup.png`).

