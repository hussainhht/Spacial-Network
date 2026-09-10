# Universe Home v1 — four-agent execution package

Planning baseline: 2026-09-10. This package contains instructions, not feature implementation. Proposed `frontend/src/features/universe-home/` paths do not exist yet; they follow the inspected feature-module convention. Existing paths below were inspected.

## Milestone

Build a cinematic homepage with one persistent R3F Canvas containing Earth with its orbiting Moon, Mars, and Saturn. Normal vertical scrolling moves each destination LEFT → CENTER → RIGHT, with nearest-planet snapping. Keep navbar, sidebar, global background, and existing feature routes. Prepare navigation interfaces; do not build the new cinematic route transition, camera zoom into pages, Moon route, sidebar replacement, backend changes, shaders, or postprocessing.

## Team and launch

Open four sessions in `/home/hussain-hht/Desktop/social-network`, on the same existing branch and working tree. Give each session the entire corresponding prompt:

| Agent | Responsibility | Prompt |
| --- | --- | --- |
| 1 | Models, Earth/Moon hierarchy, scene, camera and Canvas rendering | [01_AGENT_3D_SCENE.md](prompts/01_AGENT_3D_SCENE.md) |
| 2 | Vertical-scroll choreography, pin, scrub, snap and motion cleanup | [02_AGENT_GSAP_MOTION.md](prompts/02_AGENT_GSAP_MOTION.md) |
| 3 | Persistent provider/portal, shared state and navigation compatibility | [03_AGENT_NEXT_TRANSITIONS.md](prompts/03_AGENT_NEXT_TRANSITIONS.md) |
| 4 | Homepage composition, UX, integration and verification | [04_AGENT_INTEGRATION_UX.md](prompts/04_AGENT_INTEGRATION_UX.md) |

All can start together. Do not create worktrees or branches. These prompts authorize the next agents to implement the milestone; the planning task that created them does not implement it.

## Inspected repository facts

- `frontend/src/app/layout.tsx` owns WebSocketProvider; `(main)/layout.tsx` nests NotificationProvider, GroupStateSync and AppShell. Preserve these boundaries.
- `components/layout/AppShell.tsx` already wraps children in UniverseTransitionProvider and SidebarProvider, and renders SpaceBackground, AppSidebar, TopNavbar and `#page-content`.
- `AppShell.module.css`: shell is `100dvh` with hidden overflow; `#page-content` is the vertical scroller. Navbar consumes 64 px desktop / 104 px at <=760 px; sidebar is 244 px / 72 px and can collapse. Measure the available pane; do not assume window scrolling or full browser width.
- `(main)/page.tsx` mounts HomeOrbitalFeed. That component owns its own orbital ScrollTrigger, registers `/`, and uses provider `homePosition` for the post playhead. Replace the homepage composition without mounting the old feed beside the new track. `/posts` already exists; keep posts and their components intact.
- `features/universe-transition/UniverseTransitionProvider.tsx` already owns a stable DOM portal host and a HomeEarth Canvas, reparenting between home anchors and UniverseTransitionLayer. It already runs an Earth-specific `/` ↔ `/groups` cinematic animation, with pause/resume, watchdog and inert/overflow cleanup. It does not yet expose general planet navigation state.
- `SpaceBackground.tsx` is SVG/CSS, not WebGL. Reuse it; no extra starfield or background Canvas.
- `components/space/DevPlanetModel.tsx` exports EarthPlanetModel and GenericPlanetModel. Reuse their normalization, Earth shader materials and Saturn ring handling. Earth3D already separates transition and rotation groups but owns an Earth-only Canvas, so it cannot be nested as a planet inside the new Canvas.
- `modelsRegistry.ts` is the canonical asset registry: `frontend/public/models/planets/{earth,moon,mars,saturn}-final.glb`. Do not duplicate URLs.
- Planet Lab at `/dev/planets` uses `features/planets-dev/PlanetStage.tsx`, orthographic Canvas, Bounds around all four separate bodies and a native horizontal scroll area. Reuse model components; its layout, standalone Moon and fit-all framing are unsuitable for this homepage. `/dev/3d` is another independent development viewer. Preserve both.
- GSAP/ScrollTrigger already exist in HomeOrbitalFeed; transition animation and GroupGalaxy also use GSAP. Use scoped cleanup, never kill all global triggers.
- `frontend/package.json` declares Next ^16.3.2, React ^19.2.8, R3F ^9.7.0, Three ^0.185.1, GSAP ^3.15.0. Scripts: dev/build/start/lint; no test script. Installed Next docs exist under `frontend/node_modules/next/dist/docs/`. Read relevant guides per `frontend/AGENTS.md` before code.
- Skills actually present: seven architecture/motion/design/performance skills under `.agents/skills/`; frontend-design, webapp-testing, code-reviewer, a11y-audit, shaders/postprocessing and others under `.claude/skills/`. Use the actual paths in prompts rather than assuming all catalog paths exist.
- Read-only `git status --short` failed with `fatal: .git/index: index file smaller than expected`. No repair attempted. Worktree baseline cannot be certified with Git until the user repairs it. Inspect current files and preserve unrelated work.

## Work sequence and integration gates

1. **Independent start:** Read shared docs, publish intent in your own update file. Agent 3 publishes the exact contract exports first; Agent 1 builds rigs/rendering, Agent 2 develops math and controller against plain Three Groups, Agent 4 builds DOM/CSS and test scenarios. No one waits for full model completion.
2. **Interface gate:** Agent 3 supplies types/config/provider API; Agent 1 supplies a ready scene handle; Agent 2 supplies the motion hook. Missing imports during this early window are reported as dependency blockers, never fixed by creating another owner's implementation. Test doubles stay in owner-local test/harness files, never a second production architecture.
3. **Composition gate:** Agent 3 replaces the existing portal's HomeEarth payload with Agent 1's UniverseCanvas; Agent 4 wires homepage/anchors and Agent 2's controller. Activate the new homepage together with the legacy-transition guard. Agent 4 records readiness of both before end-to-end testing. Transient incomplete code is expected during this gate.
4. **Verification gate:** Agent 4 requests a short edit freeze in REQUESTS, waits for explicit acknowledgments in all owner updates, then runs the integrated build/browser checks. Build and dev share `.next`; Agent 4 alone schedules them sequentially. Resume owned fixes on failures, then recheck affected behavior.
5. **Handoff:** Each owner supplies files, exports, evidence and unresolved issues. Agent 4 marks completion only when every mandatory checklist item passes or is explicitly reported blocked. Do not call software-rendered browser checks proof of hardware 60 FPS.

## Communication and edit safety

Read [SHARED_CONTRACT.md](SHARED_CONTRACT.md), [FILE_OWNERSHIP.md](FILE_OWNERSHIP.md), [DECISIONS.md](DECISIONS.md), [STATUS.md](STATUS.md), [REQUESTS.md](REQUESTS.md) before work and at each handoff or interface change. Read fresh owner updates before concluding an API is missing.

Agent 4 is the sole writer of shared summary documents. Each agent writes only `updates/agent-N.md`, including status and requests; Agent 4 incorporates these into STATUS.md and REQUESTS.md. This deliberately replaces unsafe simultaneous edits to shared Markdown with single-writer logs. Logs remain authoritative while Agent 4 is offline. Use IDs `A1-001`, `A2-001`, etc.; reply under your own log referencing the ID. Poll at meaningful checkpoints and while blocked, approximately every 30–60 seconds. Continue independent work while awaiting replies.

Only the assigned owner edits a source file. A requested change does not transfer ownership. Agent 4 may record a transfer only after old and new owners acknowledge, the old owner stops writing, and FILE_OWNERSHIP is updated. No emergency cross-owner fixes, broad formatters, or global search/replace. No deletion/reversion of unfamiliar files.

## Git rule

No agent owns Git. Do not run `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, `git reset`, `git restore`, `git checkout`, `git switch`, `git stash`, or `git cherry-pick`, or any other Git-state/history mutation. Only `git status` and `git diff` are allowed. Do not repair the index, manipulate `.git`, initialize a repository, create branches or worktrees. The user handles Git.

## Execution checkpoint

2026-09-10: Implementation is underway; the planning-only description above is the inspected baseline. Canonical package path is `agents/universe-home-v1/` (D17); the pasted `docs/agents/` prefix is stale. See STATUS and owner logs for current interfaces and checks. Agent 4 uses the pre-existing dev server for read-only browser checks; final build waits for service coordination and explicit edit-freeze acknowledgments.
