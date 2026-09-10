# Agent 3 — exclusive update log

Writer: Agent 3 only. Agent 4 reads and incorporates updates into STATUS.md and REQUESTS.md. Preserve prior requests/replies until incorporated; never edit someone else's log.

## Current status

Timestamp: 2026-09-10, interface + portal/guard checkpoint
State: READY FOR INTEGRATION
Working on: Nothing further planned. All assigned scope implemented; awaiting integrated verification.
Ready exports: All published (see Handoff).
Blocked by: Nothing. Remaining work is Agent 4's integrated browser/build verification.
Files currently being edited: None (see freeze acknowledgment below).
Validation/evidence: ESLint PASS, project TypeScript PASS, 21/21 owner harness assertions. Commands and results below.
Contract version acknowledged: SHARED_CONTRACT v1, unchanged. No contract revision requested or made.
Edit-freeze acknowledgment: **A4-004 ACKNOWLEDGED — Agent 3 has stopped editing source files as of this entry.** Owned paths are stable and safe to build. If a failure is attributed to my files I will ask before resuming; I will not edit during the freeze without an explicit request from Agent 4.

Read-only `git status --short` / `git diff --stat` still fail with `fatal: .git/index: index file smaller than expected`. No repair, no Git mutation (D16 / PLAN-004). My changed-file list below is from direct filesystem inspection, not Git.

## Requests and replies

### PLAN-001 — Contract publication (COMPLETE, awaiting Agent 4 closure)

`contracts.ts` and `navigation/planetDestinations.ts` published exactly as SHARED_CONTRACT specifies. Verified no duplicate type or config definition exists in production: Agent 1 and Agent 4 import `PLANET_ORDER`/`PLANET_DESTINATIONS` from my config, and Agent 2's `motionMath.DEFAULT_PLANET_ORDER` is a re-export alias of my `PLANET_ORDER`, not a second definition. `useUniverseHome()` is now also published.

### PLAN-002 — Portal and homepage activation gate (COMPLETE from Agent 3's side)

Portal payload adaptation and the legacy navigate guard are both implemented and active in the same change, as required. `(main)/page.tsx` already mounts `UniverseHome`, so the pairing condition is satisfied. Agent 3 reports ready for the runtime verification half of this gate.

### A4-004 — Final source edit freeze (ACKNOWLEDGED)

Explicitly acknowledged above. Agent 3 is not editing source.

### A1-001 — Scene verification scheduling (reply to Agent 1)

Payload is connected: your `scene/UniverseCanvas` default export is now the provider's portal payload and receives `ref`, `className`, `renderActive`, `reducedMotion` and a stable `onSceneReady`. Your `renderActive`/`frameloop` contract from the interface checkpoint is honoured exactly — see Handoff. Ready for Agent 4 to schedule your scene checks.

### A3-001 — Agent 2 harness command does not run as documented (OPEN, non-blocking)

- From/To: Agent 3 → Agent 2 (2026-09-10). Informational; no interface change requested.
- Exact path: `frontend/src/features/universe-home/motion/motionHarness.ts`, header comment.
- Need: Confirm the command that actually produced "57/57", or correct the documented one.
- Reason: The documented `node --no-warnings --experimental-strip-types src/features/universe-home/motion/motionHarness.ts` fails here with `ERR_MODULE_NOT_FOUND` for `./motionMath` (Node v24.18.0, run from `frontend`). Node's ESM resolver will not follow the project's extensionless imports, which are correct for the bundler and must not be changed for tests. I hit the same wall and worked around it by compiling to CommonJS in a scratch directory (command in my evidence below) rather than touching production imports.
- Acceptance: Agent 2's harness runs from a documented command, or the header records the real one. Motion evidence stands or falls on that; I am not disputing the assertions themselves and did not touch your files.
- Status: OPEN, informational. Does not block integration.

## Handoff

### Published exports and exact import paths

- `@/features/universe-home/contracts` — all v1 types, verbatim from SHARED_CONTRACT: `PlanetId`, `PlanetDestination`, `PlanetRigHandle`, `UniverseSceneHandle`, `UniverseCanvasProps`, `HomeMotionController`, `HomeMotionOptions`, `UniverseHomeAPI`.
- `@/features/universe-home/navigation/planetDestinations` — `PLANET_DESTINATIONS` (Earth/Posts `/posts`, Mars/Groups `/groups`, Saturn/Profile `/profile`, in track order), `PLANET_ORDER` derived from it, and `getPlanetDestination(id)`. No Moon route, no Messages destination, no duplicated asset URLs.
- `@/features/universe-transition/UniverseTransitionProvider` — **`useUniverseHome(): UniverseHomeAPI`** (named), alongside the unchanged default export and unchanged `useUniverseTransition()`.

Provider internals (mine, not a public surface): `navigation/homeMode.ts`, `homeProgress.ts`, `homeSelection.ts`, `useUniverseHomeState.ts`, `UniverseCanvasHost.tsx`, `navigationHarness.ts`.

### API semantics

- The provider is the only authority for `activePlanetId`, `selectedPlanetId`, `homeProgress`, `scene`, `reducedMotion` and `isTransitioning`.
- `reportHomeProgress(p)` clamps to `[0,1]` (NaN → 0, ±Infinity → 0/1), writes the ref every tick, and changes React state only when `round(p*(N-1))` changes — two renders per full scrub, not one per frame. The active index is derived, never a second stored state.
- `homeProgress` is a stable ref for the provider's lifetime and **is initialized to 0 before any page renders**, so Agent 2 can read it on mount/resize and restore scroll offset and rig x before the first ordinary update. It persists across every route change, including routes where the Canvas unmounts.
- `homeProgress` is deliberately **not** the legacy `homePosition`; that ref still carries the old feed's post playhead and is untouched.
- `selectPlanet(id)` records a choice only — no route push, no zoom, no progress write, no input lock. It clears when a different planet becomes active, and reads as null once navigation settles on another route.
- `isTransitioning` reads the existing coordinator. There is no second transition machine and no new phase enum. Under v1 it is always false, because nothing sets a run.
- `reducedMotion` is the provider's single `useSyncExternalStore` preference, reactive to live changes, and is the same value passed to the scene.

### Canvas props and docking (confirmed against Agent 1's interface checkpoint)

- Payload: `scene/UniverseCanvas` default export, via `navigation/UniverseCanvasHost` using `next/dynamic` with `ssr: false` from a client module. The wrapper adds an error boundary **above** the scene's own, because this payload is portalled from the provider that wraps the whole shell — a chunk-load failure would otherwise unmount the sidebar, navbar and every destination link. It is `memo`'d so provider state changes never re-render the scene.
- Props passed: `ref={setStage}` (stable callback ref), `className={styles.universeStage}`, `renderActive={pathname === "/" || isTransitioning}`, `reducedMotion`, `onSceneReady` (stable).
- `renderActive` is **independent of reduced motion**, per Agent 1's request: reduced-motion Home still draws.
- Docking selector is **`[data-universe-viewport]` inside the registered `/` root** — not the old Earth anchor's parent. Docking waits for `clientWidth > 0 && clientHeight > 0`; a ResizeObserver re-checks on measurement and resize, including animated sidebar collapse. The stage arrives only after the lazy chunk resolves, so docking no longer requires it to exist.
- Stage CSS `position: absolute; inset: 0; pointer-events: none`, written as a doubled class so it outranks the scene module's own `.stage` without `!important` or bundle-order luck. It fills Agent 4's measured viewport and sits under the z-indexed caption/destinations. It never intercepts navbar or sidebar pointer input.
- Host identity is preserved across Home ↔ Groups; `renderActive=false` sleeps it on Groups. It parks in `UniverseTransitionLayer` before the homepage DOM is removed, and a stale registration cleanup can no longer pull it out of a newer registration's viewport.
- Unrelated routes and dev viewers keep the existing policy: the renderer is not mounted at all, and provider progress still survives.

### v1 navigation guard behavior — and which visuals are deliberately bypassed

`navigate('/')` and `navigate('/groups')` return **false** under v1, in both directions and on direct `/groups` entry or hard refresh alike, because the mode is a module constant in `navigation/homeMode.ts`, not state set after first visiting Home. Callers (AppSidebar) therefore never call `preventDefault()`, and the existing Next Links navigate normally. Modified clicks, Back/Forward and focus are unaffected — `onNavigate` does not fire for modified clicks at all.

**Deliberately bypassed:** the entire legacy Earth-to-galaxy cinematic — the posts-inward exit, Earth travel/rotate/collapse, the energy glow, the rings/nodes entrance on Groups and the reverse sequence. `animation.ts` is unmodified and its `EarthHandle` mutations and body scroll locks never run against the new scene. The legacy path is isolated, not rewritten, so it can be redesigned later. Its watchdog, inert and overflow cleanup guarantees remain intact for that retained path; under v1 nothing sets a run, so they simply never engage.

### Future transition seam (documented, not implemented)

Nothing pushes a route on scroll or snap. A later coordinator would: pause the registered `/` controller, operate on a rig's `transitionRoot` (identity in v1, separate from the `scrollRoot` Agent 2 owns), push the `href` from `planetDestinations`, reveal the destination and resume — reusing the persistent host, `selectedPlanetId` and the existing `isTransitioning`. Written up in `features/universe-transition/README.md`.

### Files finished

- New: `frontend/src/features/universe-home/contracts.ts`; `navigation/{planetDestinations,homeMode,homeProgress,homeSelection,useUniverseHomeState}.ts`; `navigation/UniverseCanvasHost.tsx`; `navigation/navigationHarness.ts` (owner-local).
- Modified: `frontend/src/features/universe-transition/UniverseTransitionProvider.tsx`, `UniverseTransition.module.css`, `README.md`.
- Untouched, as required: `animation.ts`, `types.ts` (no change needed — legacy types retained as-is), `UniverseTransitionLayer.tsx` (no change needed), and every other owner's file.

### Validation evidence

Run from `frontend`. No app server or build started; Agent 4 owns those.

- `./node_modules/.bin/eslint src/features/universe-home/contracts.ts src/features/universe-home/navigation src/features/universe-transition` — **PASS (exit 0)**.
- `./node_modules/.bin/tsc --noEmit --incremental false` — **PASS (exit 0), whole project**, so all four owners' current files type-check together. This confirms every existing `useUniverseTransition()` consumer (AppSidebar, TopNavbar, GroupGalaxy, and the now-unmounted HomeOrbitalFeed with its `homePosition` post semantics) still compiles unchanged.
- Owner harness, 21 assertions covering clamping, index boundaries at .25/.75, snap stops, `N<=1` and `N=0` guards, index/progress round-trip, selection staleness and identity retention, a full simulated scrub committing exactly `N-1` times, and the configured route order:
  - `./node_modules/.bin/tsc --outDir /tmp/universe-home-agent-3/build --module commonjs --moduleResolution node --target es2022 --skipLibCheck --esModuleInterop --types node src/features/universe-home/navigation/navigationHarness.ts`
  - `node --test /tmp/universe-home-agent-3/build/navigation/navigationHarness.js` — **21/21 PASS, 0 fail**.
  - CommonJS output is used only because Node's ESM resolver cannot follow the project's extensionless imports; production imports were not changed for testing. No package installed, no npm script invented.
- Source inspection confirms exactly one payload mount path (`HomeEarth` appears only in the disabled legacy branch) and no second `activePlanetId`/progress store anywhere in `src`.

**Not run by me, and not claimed:** browser/runtime behavior. Everything below needs Agent 4's integrated run, and none of it is verified by the above.

### Checks Agent 4 should run against my scope

1. Direct `/` load and direct `/groups` load; Home → Groups → Home ×5 with the same Canvas node identity and exactly one Canvas.
2. Sidebar Home and Groups links navigate with **no** Earth cinematic and no full refresh; modified/middle clicks stay native; Back/Forward leave no inert root, body/pane overflow or pointer lock.
3. Ordinary `/posts`, `/profile`, `/chat` routing; renderer absent there; `/dev/planets` and `/dev/3d` still work and do not coexist with the universe renderer.
4. Scroll partway, navigate away, return — progress and planet restore before any default update overwrites them (this is the `homeProgress` restoration path Agent 2 consumes).
5. Host docks into `[data-universe-viewport]` on arrival and parks before unmount; sidebar collapse/expand and resize re-dock without losing progress.
6. Navbar and sidebar remain clickable over the Canvas area (the stage is `pointer-events: none`).
7. Reduced motion on Home still draws the scene (only spin/orbit stop).

### Known risks and limitations

- Git baseline cannot be certified; the index error is pre-existing and user-owned.
- Docking depends on Agent 4's viewport having a non-zero measured size. If `--universe-pane-height` ever resolves to 0, the host stays parked by design rather than publishing an unusable scene handle; the ResizeObserver docks it as soon as it is measured. Worth watching in the 390×844 and short-viewport runs.
- If the scene payload hard-fails, my boundary keeps it unmounted for the rest of the session rather than retrying on the next route change. DOM destination links are outside the payload and stay usable; this is a deliberate trade against re-throwing into the shell.
- ~~Ref forwarding through `memo` + `next/dynamic` was a risk~~ — **resolved by source inspection.** In React 19.2.8 (`react/cjs/react-jsx-runtime.production.js` `jsxProd`), only `key` is stripped from config; `ref` stays in `props`. So it survives `memo`, next/dynamic's `LoadableComponent` `{...props}` spread and `React.lazy` down to `UniverseCanvas({ ref, ... })`. Worth knowing the failure mode anyway: if the stage ref did not attach, the scene would still render docked on Home but would not be hidden while parked on Groups — visible, not fatal. Agent 4's Groups check covers it.

### Unresolved request IDs

- A3-001 (→ Agent 2): OPEN, informational, non-blocking.
- A1-001 (→ Agent 4): my side is complete; Agent 1 verifies.
- PLAN-001 / PLAN-002: complete from Agent 3's side; Agent 4 closes after verification.

Requesting Agent 4 incorporate this final status. Stopping at the assigned milestone boundary: no cinematic route transition started, no Git work.
