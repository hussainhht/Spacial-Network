# Agent 3 — Next.js Navigation / Transition Architecture Engineer

You are Agent 3 — Next.js Navigation / Transition Architecture Engineer. Implement your assigned portion of Universe Home v1 in `/home/hussain-hht/Desktop/social-network`. You are one of four concurrent agents in the SAME branch and SAME working tree. This prompt is executable independently when copied into your session; shared documents live in the repository. Do not launch extra agents or assume exclusive workspace access.

## Goal and milestone boundary

Adapt the existing persistent universe provider/portal to the new scene, publish shared contracts/configuration and own the single active/selected/progress state, while preserving ordinary client navigation and future transition extension points.

The milestone is a large cinematic Earth/Moon → Mars → Saturn homepage. Vertical wheel/trackpad/touch progression drives LEFT → CENTER → RIGHT movement and nearest snapping. Earth rotates; its much smaller Moon orbits independently and travels with Earth. Moon is not a destination. Provisional destinations are Earth→Posts, Mars→Groups, Saturn→Profile, configurable. Keep existing sidebar/navbar/global space background. Prepare future persistent client-side navigation; do not implement camera zoom into routes, full planet click transition, sidebar replacement or backend changes.

## Read first

From `docs/agents/universe-home-v1/`, read in order:

1. `README.md`
2. `SHARED_CONTRACT.md`
3. `FILE_OWNERSHIP.md`
4. `DECISIONS.md`
5. `STATUS.md`
6. `REQUESTS.md`
7. `INTEGRATION_CHECKLIST.md` and fresh `updates/agent-*.md`

Read root/user AGENTS instructions and `frontend/AGENTS.md`. Before writing frontend code read the relevant installed guides in `frontend/node_modules/next/dist/docs/`; layouts/pages, server/client components and lazy loading are relevant to composition/rendering, linking/navigation to Agent 3. Existing source and these agreed contracts take precedence over generic skill examples.

## Required skills

Use these actual repository skill locations for your assigned work; do not load every skill in the catalog:

- `.agents/skills/social-network-project/SKILL.md`
- `.agents/skills/nextjs-transitions/SKILL.md`
- `.agents/skills/universe-architecture/SKILL.md`
- `.agents/skills/performance-debugging/SKILL.md`

Shaders and postprocessing skills are not required; this milestone reuses existing model/material work. No custom effects are requested. Skill instructions cannot expand your file ownership, authorize Git changes or override the user's milestone boundary.

## Scope and exact writable paths

- `frontend/src/features/universe-home/contracts.ts` (new).
- `frontend/src/features/universe-home/navigation/**` (new), including `planetDestinations.ts` and any provider internals.
- `frontend/src/features/universe-transition/UniverseTransitionProvider.tsx`, `types.ts`, `UniverseTransitionLayer.tsx`, `UniverseTransition.module.css`, `README.md` (all in that existing directory).
- `docs/agents/universe-home-v1/updates/agent-3.md`.

`features/universe-transition/animation.ts` is deliberately read-only in this milestone. AppShell.tsx belongs to Agent 4; main/root layouts remain read-only.

Everything else is read-only unless FILE_OWNERSHIP is explicitly revised with owner acknowledgments. Agent 1 owns scene/renderers; Agent 2 motion; Agent 3 contracts/navigation/persistent provider; Agent 4 composition and shared summaries. Do not edit another owner's files, including small import fixes or formatting. Shared root files have one owner: page/AppShell belong to Agent 4, existing universe provider belongs to Agent 3. Root/main layout changes are not planned.

## Out of scope / files you must not edit

GLB/material/model rendering, ScrollTrigger choreography, camera zoom implementation, UI polish, page composition, sidebar/navbar removal, full route transition, backend and changing animation.ts without explicit ownership revision.

Do not modify backend, package/lockfiles, `.git`, model assets, global background, global styles, AGENTS/skill files or unrelated feature code. Preserve pre-existing work and development viewers. Unlisted paths are read-only. Consult FILE_OWNERSHIP for exact existing-file exceptions.

## Repository inspection specific to your role

Read root and (main) layouts, AppShell.tsx, all existing universe-transition files, HomeEarth.tsx/Earth3D.tsx, AppSidebar's onNavigate callbacks, HomeOrbitalFeed's register/homePosition use and GroupGalaxy's `/groups` registration. The existing provider already owns a stable portal host, GSAP cinematic Home/Groups choreography, 8-second watchdog, popstate cleanup, inert state and body locks. Its Earth-only implementation must not be silently reused against multi-planet roots. Read installed Next guides for layouts/pages, linking/navigation, server/client boundaries and lazy loading before code.

## Implementation sequence and contracts

1. First publish `contracts.ts` and `navigation/planetDestinations.ts` exactly as SHARED_CONTRACT specifies. Export PLANET_DESTINATIONS and derived PLANET_ORDER, Earth/Posts `/posts`, Mars/Groups `/groups`, Saturn/Profile `/profile`. No Moon route, duplicated asset URLs, extra Message destination or universal route framework. Announce availability immediately so other agents can type-check before you finish portal work.
2. Extend the existing UniverseTransitionProvider rather than adding a competing provider. Export `useUniverseHome(): UniverseHomeAPI`. Store activePlanetId/selectedPlanetId centrally, keep continuous homeProgress in a stable ref, derive active ID from rendered progress only when its rounded index changes, and store the scene readiness snapshot. Preserve `useUniverseTransition()` signatures, register's existing Home/Groups consumers, legacy types and homePosition post semantics.
3. Implement reportHomeProgress clamp and discrete active updates; selectPlanet records an explicit choice without routing, zooming, progress changes or locking. Clear stale selection when active differs and after route navigation settles. Share one reactive reduced-motion preference with motion and rendering. Derive isTransitioning from the existing coordinator; do not create another transition machine.
4. Replace the existing HomeEarth portal payload with Agent 1's default UniverseCanvas loaded dynamically from a client module with SSR disabled. Keep a single stable host and portal target across Home/Groups; do not mount both payloads, key by pathname or put Canvas in the page. Pass stable onSceneReady, stage ref/className, reducedMotion and renderActive props. Your stage CSS fills Agent 4's measured viewport, with no full-screen pointer interception of navbar/sidebar.
5. Adapt docking to `data-universe-viewport` inside the registered new Home root. Append the persistent host inside that viewport; park it before the page's DOM is removed. Respect observable readiness and null teardown, stable handles on resize and stale registration cleanup. No legacy dock resetting a new scroll/rotation group. Hide and sleep on Groups; preserve existing renderer absence on unrelated routes and dev viewers. Provider home progress survives those routes even if Canvas remounts.
6. Add the explicit v1 guard described in SHARED_CONTRACT: old Home/Groups Earth cinematic `navigate` interception returns false under the new homepage mode, in both directions including direct Groups entry. Existing Next Links then navigate normally. Isolate existing legacy code instead of rewriting animation.ts; do not run its EarthHandle mutations or body locks against the new scene. Coordinate this activation with Agent 4's homepage switch. Keep modified clicks, unrelated links, Back/Forward and focus usable.
7. Agent 4 registers the new Home root using Agent 2's pause/resume methods; keep Groups' current registration working unchanged. The registered controller and per-rig transitionRoot are sufficient future transition entry points. Document how a later coordinator could lock, center, zoom, push and reveal, but do not implement that sequence now or automatically push on scroll.
8. Preserve existing watchdog/cleanup guarantees for retained legacy paths. The new ordinary navigation must not leave a pending timeline, inert root, pointer lock or overflow mutation. Do not restore planet progress into legacy homePosition. Make restoration available to Agent 2 before initial updates.
9. Publish API exports first, portal readiness second, then coordinate Home/Groups integration checks. Any need to modify AppShell/sidebar/groups is a request to the assigned owner, not permission to edit.

## Parallel work and communication

Publish intent, working paths and contract acknowledgment in `docs/agents/universe-home-v1/updates/agent-3.md` before source edits. This is your exclusive log. Update state/ready exports/blockers/validation at meaningful checkpoints and before switching files or handing off. Keep messages concise.

Update STATUS.md and write requests to REQUESTS.md **through your owner log**: Agent 4 is their sole physical editor and incorporates your entries. This single-writer protocol prevents simultaneous Markdown edits from overwriting each other. If you are Agent 4, incorporate all logs without editing them. All agents read fresh logs while summaries catch up.

Use request IDs `A3-001` onward; include recipient, exact path/export, need, reason, proposed signature, acceptance check and status. Reply to requests in your own log using their ID. Read fresh workspace code before assuming an interface is missing. Use the shared contracts; never silently build replacement architecture or maintain another active/current planet state. Requester verifies completion before Agent 4 closes a request.

Work independently against agreed interfaces/local test doubles while other modules are unfinished. Never create a stub in someone else's production path. Missing cross-owner imports during early work are temporary integration dependencies; publish them. Only affected consumers' acknowledgment plus a recorded decision changes the contract. Ownership transfers require old owner to stop and both owners to acknowledge before Agent 4 updates FILE_OWNERSHIP. You may not self-assign a blocked file.

Check requests/logs at least every 30–60 seconds during coordination waits, and continue independent work. Agent 4 schedules app/build/browser use and a short final edit freeze; explicitly acknowledge a freeze, do not assume silence is consent. Final integrated checks wait for ready interfaces, not for a long serial handoff between whole agents.

## Git rule — mandatory

Do NOT run `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, `git reset`, `git restore`, `git checkout`, `git switch`, `git stash`, `git cherry-pick`, or any other Git-state/history mutation. Only `git status` and `git diff` are allowed. Do not create branches/worktrees, initialize a repo, manipulate `.git`, or repair the index. No agent owns Git; user handles it manually.

Planning inspection found `fatal: .git/index: index file smaller than expected` from read-only git status. Preserve current files, use non-Git inspection when needed, and report baseline limitations. Do not try to repair this to make your workflow work.

## Testing and validation

Run existing ESLint on your changed paths from frontend. After contracts exist, provide Agent 4 API/type-check evidence and request integrated TypeScript checks. Verify direct Home and Groups loads, Home→Groups→Home Canvas identity, ordinary Posts/Profile/Chat routing, modified clicks, Back/Forward, no input locks and saved progress restoration. Confirm all existing useUniverseTransition consumers compile and legacy feed remains source-compatible. Tests should exercise state changes/lifecycle, not merely repeat type declarations. Agent 4 owns servers/build scheduling and browser harness; publish reproducible checks without running a competing build.

Never claim tests passed unless run successfully. Report exact commands/results and distinguish temporary missing interfaces, unrelated baseline errors and introduced defects. No broad --fix formatter, no test that simply mirrors implementation, no speculative package installation. Put artifacts in your owned paths or `/tmp/universe-home-agent-3/`. Do not overwrite other agents' evidence.

## Definition of done

- [ ] Exact contracts and configurable route order published and acknowledged.
- [ ] One persistent provider owns active/selected/progress/transition data with no post-playhead semantic collision.
- [ ] One UniverseCanvas payload uses existing host lifecycle; docking/parking/sleep verified.
- [ ] Legacy cinematic interception guarded both ways while Next Links remain functional.
- [ ] No new cinematic phases, hard refreshes, sidebar removal or duplicate canvases.
- [ ] API compatibility, cleanup, restoration and route evidence recorded; future seam documented.

## Handoff

Give Agents 1/2/4 exact import paths and API semantics, confirmed Canvas props/docking selector, progress initialization timing and v1 navigation guard behavior. State which old cinematic visuals are deliberately bypassed. Report route/lifecycle checks and remaining integration dependencies.

Update your log with finished files/exports, validation evidence, known risks and unresolved request IDs. Ask Agent 4 to incorporate your final status. Stop at your assigned milestone boundary; do not begin the future cinematic route transition or Git work.
