# Agent 2 — GSAP / Motion Engineer

You are Agent 2 — GSAP / Motion Engineer. Implement your assigned portion of Universe Home v1 in `/home/hussain-hht/Desktop/social-network`. You are one of four concurrent agents in the SAME branch and SAME working tree. This prompt is executable independently when copied into your session; shared documents live in the repository. Do not launch extra agents or assume exclusive workspace access.

## Goal and milestone boundary

Implement vertical-scroll-driven horizontal planet movement, measured pinning, scrub, nearest-planet snap and cleanup against the shared scene handle.

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
- `.agents/skills/gsap-motion/SKILL.md`
- `.agents/skills/universe-architecture/SKILL.md`
- `.agents/skills/performance-debugging/SKILL.md`

Shaders and postprocessing skills are not required; this milestone reuses existing model/material work. No custom effects are requested. Skill instructions cannot expand your file ownership, authorize Git changes or override the user's milestone boundary.

## Scope and exact writable paths

- `frontend/src/features/universe-home/motion/**` (new): `useUniverseHomeMotion.ts`, motion math/helpers and owner-local tests/harnesses.
- `docs/agents/universe-home-v1/updates/agent-2.md`.

Everything else is read-only unless FILE_OWNERSHIP is explicitly revised with owner acknowledgments. Agent 1 owns scene/renderers; Agent 2 motion; Agent 3 contracts/navigation/persistent provider; Agent 4 composition and shared summaries. Do not edit another owner's files, including small import fixes or formatting. Shared root files have one owner: page/AppShell belong to Agent 4, existing universe provider belongs to Agent 3. Root/main layout changes are not planned.

## Out of scope / files you must not edit

Model/GLB/material internals, new Canvas, camera/lighting, route orchestration/router.push, provider state implementation, homepage visual redesign, global CSS, backend and full cinematic transition.

Do not modify backend, package/lockfiles, `.git`, model assets, global background, global styles, AGENTS/skill files or unrelated feature code. Preserve pre-existing work and development viewers. Unlisted paths are read-only. Consult FILE_OWNERSHIP for exact existing-file exceptions.

## Repository inspection specific to your role

Read HomeOrbitalFeed.tsx's existing ScrollTrigger scroller/resize/pause-resume pattern, `components/layout/AppShell.module.css` and AppShell.tsx, plus `features/universe-transition/{types.ts,UniverseTransitionProvider.tsx,animation.ts}` under frontend/src. #page-content is the real overflow-y:auto scroller; the body sits inside a clipped 100dvh shell. Planet Lab's native horizontal scrolling is not the required interaction. Existing skills' negative-x carousel example has the wrong direction for this brief.

## Implementation sequence and contracts

1. Acknowledge contract and begin with pure math/controller development using plain Three Group test doubles in your own harness; do not wait for GLBs or complete Agent 1 work. Import final shared types/config from Agent 3 once published, never create production substitutes.
2. Export named `useUniverseHomeMotion(options: HomeMotionOptions): HomeMotionController` from the agreed module. Inputs may be null initially; create no trigger until DOM/scene readiness, return stable safe methods meanwhile. Agent 4 calls your hook and registers its pause/resume with the existing provider.
3. Use configured order and Agent 1's uniform world spacing S. For normalized rendered progress p and index i: x=(p*(N-1)-i)*S. Positive x moves right. At p=0 Earth is center, others left; p=.5 Mars center; p=1 Saturn center. Write only rig.scrollRoot.position.x. No GLB loading, intrinsic rotation, camera or TransitionRoot animation.
4. Use explicit `scroller: #page-content` supplied as an element, pin the supplied viewport inside root, allocate vertical travel/pin spacing and use smooth bounded scrub. Agent 4 owns DOM sizing; do not create another scrollable pane or use body as scroller. Preserve ordinary touch/wheel/trackpad input with no global preventDefault or native horizontal scrollbar requirement.
5. Snap to the nearest configured stop i/(N-1) with bounded duration and interruptibility; avoid directional/velocity bias if it would choose a farther stop. Handle N<=1 without division by zero or pointless pinning. Do not route on snap. Publish rendered tween progress through onProgress so provider derives active ID only on changes; do not create a competing active/current planet React state.
6. On setup restore saved progressRef to both transforms and measured scroll position before normal updates. On resize/sidebar collapse, batch ResizeObserver refreshes, recompute travel and spacing, preserve normalized progress and invalidate rendering. Use the freshly published scene metrics. Account for sidebar width animation, not just window resize. Keep one owned trigger per home track.
7. Implement pause/resume and goToPlanet. Pause stops scrub/snap without resetting visual progress; resume restores correctly. goToPlanet changes scroll/playhead to the matching configured stop with ordinary motion rules, immediate under reduced motion; disabled/not-ready calls are safe. Integrate demand invalidation. No method changes selected state or pushes routes.
8. Scope GSAP in context/matchMedia and revert only your own context. Remove observers/listeners and kill your own pending animations on dependency changes and unmount. Never `ScrollTrigger.getAll().forEach(kill)` across the app. Preserve/reset styles you actually changed; avoid body overflow mutations for the current milestone.
9. Reduced motion: no smooth scrub/snap or continuous travel. Provide discrete nearest-stop placement from vertical progression and immediate accessible controls; no scroll trap. Agent 3 supplies the shared preference; Agent 1 stops spin/orbit.
10. Publish setup/readiness, cleanup and sizing expectations to Agents 1/4. If the shared handle is insufficient, request a change rather than reaching inside model components.

## Parallel work and communication

Publish intent, working paths and contract acknowledgment in `docs/agents/universe-home-v1/updates/agent-2.md` before source edits. This is your exclusive log. Update state/ready exports/blockers/validation at meaningful checkpoints and before switching files or handing off. Keep messages concise.

Update STATUS.md and write requests to REQUESTS.md **through your owner log**: Agent 4 is their sole physical editor and incorporates your entries. This single-writer protocol prevents simultaneous Markdown edits from overwriting each other. If you are Agent 4, incorporate all logs without editing them. All agents read fresh logs while summaries catch up.

Use request IDs `A2-001` onward; include recipient, exact path/export, need, reason, proposed signature, acceptance check and status. Reply to requests in your own log using their ID. Read fresh workspace code before assuming an interface is missing. Use the shared contracts; never silently build replacement architecture or maintain another active/current planet state. Requester verifies completion before Agent 4 closes a request.

Work independently against agreed interfaces/local test doubles while other modules are unfinished. Never create a stub in someone else's production path. Missing cross-owner imports during early work are temporary integration dependencies; publish them. Only affected consumers' acknowledgment plus a recorded decision changes the contract. Ownership transfers require old owner to stop and both owners to acknowledge before Agent 4 updates FILE_OWNERSHIP. You may not self-assign a blocked file.

Check requests/logs at least every 30–60 seconds during coordination waits, and continue independent work. Agent 4 schedules app/build/browser use and a short final edit freeze; explicitly acknowledge a freeze, do not assume silence is consent. Final integrated checks wait for ready interfaces, not for a long serial handoff between whole agents.

## Git rule — mandatory

Do NOT run `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, `git reset`, `git restore`, `git checkout`, `git switch`, `git stash`, `git cherry-pick`, or any other Git-state/history mutation. Only `git status` and `git diff` are allowed. Do not create branches/worktrees, initialize a repo, manipulate `.git`, or repair the index. No agent owns Git; user handles it manually.

Planning inspection found `fatal: .git/index: index file smaller than expected` from read-only git status. Preserve current files, use non-Git inspection when needed, and report baseline limitations. Do not try to repair this to make your workflow work.

## Testing and validation

Run existing ESLint from frontend on changed motion files. Use the available repository/local tooling for meaningful math checks at p=0/.5/1, reverse motion, midpoint snap boundaries, N<=1 and progress restoration. Do not invent npm test: package.json has no test script. Ask Agent 4 to exercise wheel/trackpad/touch, keyboard controls, StrictMode cleanup, repeated remounts, sidebar resize and reduced motion in the integrated app. Supply expected trigger count and lifecycle evidence; use owner-local harnesses until scene is ready. Do not add a package or manipulate another owner's code just to get a test runner.

Never claim tests passed unless run successfully. Report exact commands/results and distinguish temporary missing interfaces, unrelated baseline errors and introduced defects. No broad --fix formatter, no test that simply mirrors implementation, no speculative package installation. Put artifacts in your owned paths or `/tmp/universe-home-agent-2/`. Do not overwrite other agents' evidence.

## Definition of done

- [ ] Motion hook and stable null-safe controller methods match contract.
- [ ] Vertical pane scroll produces LEFT → CENTER → RIGHT and nearest intentional resting states.
- [ ] Only ScrollRoot.x is animated; provider is sole active-state owner.
- [ ] Restoration/resize/reduced-motion behavior works without per-tick React state updates.
- [ ] Owned GSAP/observer/listener cleanup leaves no duplicate triggers or trapped scrolling.
- [ ] Math/lifecycle validation and integration instructions recorded.

## Handoff

Give Agent 4 hook import, DOM sizing/scroller assumptions, pause/resume/goToPlanet behavior and test steps. Give Agent 3 progress semantics and restoration requirements; give Agent 1 verified spacing/handle feedback. Record evidence and unresolved browser checks.

Update your log with finished files/exports, validation evidence, known risks and unresolved request IDs. Ask Agent 4 to incorporate your final status. Stop at your assigned milestone boundary; do not begin the future cinematic route transition or Git work.
