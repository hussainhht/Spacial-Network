# Exclusive file ownership

Paths are repository-relative. New paths are explicitly marked. Any file not assigned here is read-only. Prefix ownership excludes files explicitly assigned to another owner; there are no overlapping source prefixes below. Existing file ownership is permission for necessary scoped changes, not a request to rewrite it.

| Owner | Exact writable source paths | Purpose |
| --- | --- | --- |
| Agent 1 | `frontend/src/features/universe-home/scene/**` (new) | UniverseCanvas.tsx, PlanetRig.tsx, EarthSystem.tsx, sceneConfig.ts, local scene helpers/styles/tests |
| Agent 1 | `frontend/src/components/space/DevPlanetModel.tsx` | Only a demonstrated reusable renderer fix if wrappers cannot suffice; preserve labs |
| Agent 2 | `frontend/src/features/universe-home/motion/**` (new) | useUniverseHomeMotion.ts, pure positioning helpers, owned tests/harnesses |
| Agent 3 | `frontend/src/features/universe-home/contracts.ts` (new) | Exact shared interface exports |
| Agent 3 | `frontend/src/features/universe-home/navigation/**` (new) | planetDestinations.ts, provider internals if needed |
| Agent 3 | `frontend/src/features/universe-transition/UniverseTransitionProvider.tsx`, `types.ts`, `UniverseTransitionLayer.tsx`, `UniverseTransition.module.css`, `README.md` in that same directory | Persistent portal, home API, mode guard, registration/docking; preserve old consumer API |
| Agent 4 | `frontend/src/app/(main)/page.tsx` | Replace homepage composition |
| Agent 4 | `frontend/src/features/universe-home/UniverseHome.tsx`, `UniverseHome.module.css`, `ui/**` (all new) | DOM anchors, motion wiring, controls, restrained styling |
| Agent 4 | `frontend/src/components/layout/AppShell.tsx`, `AppShell.module.css` | Only integration/layout corrections if needed; provider already exists |
| Agent 4 | `frontend/src/features/universe-home/integration/**` (new) | Browser harnesses and integration evidence helpers if needed |
| Agent 2 (transfer D18 **reverted** by D19) | `frontend/src/features/universe-home/motion/useUniverseHomeMotion.ts` | Transfer exercised then withdrawn; file restored to Agent 2's original content and ownership. Defect A4-007 stays open against Agent 2 |
| Agent 4 (transferred from Agent 3, D18) | `frontend/src/features/universe-home/navigation/homeSelection.ts`, `navigation/useUniverseHomeState.ts` | Defect fix only: permanently clear a recorded selection after route navigation settles. No public signature change |

Do not create an index.ts shared barrel, global config file or generic universe-home root utility outside these allocations. Tests stay under the owning directory. Temporary experiment files belong in an owner-specific `/tmp/universe-home-agent-N/` directory and must not become production imports.

## Existing systems remain read-only

`frontend/src/app/layout.tsx`, `(main)/layout.tsx`, all feature destination pages, AppSidebar.tsx, TopNavbar.tsx and their contexts/styles, SpaceBackground.tsx and its styles/data, HomeEarth.tsx, Earth3D.tsx, earthMaterials.ts, modelsRegistry.ts, `features/universe-transition/animation.ts`, HomeOrbitalFeed and posts/groups/chat/notification components, Planet Lab and dev/3d, all model assets, globals.css, package manifests/lockfiles, backend, AGENTS.md, skill files and `.git`.

If inspection proves one needs a change, request it first; Agent 4 must assign exactly one owner and record the reason before editing. There is no implied blanket permission to modify these files. Do not change API/domain behavior. Do not remove sidebar/navbar or global background.

## Documentation ownership

Agent 4 alone writes README.md, SHARED_CONTRACT.md, FILE_OWNERSHIP.md, STATUS.md, REQUESTS.md, DECISIONS.md and INTEGRATION_CHECKLIST.md in this package. Agent N alone writes `updates/agent-N.md`. Prompt files are the launch baseline and are read-only during execution unless Agent 4 records an agreed correction. Every agent updates shared status/requests by publishing to their own log; Agent 4 incorporates them. No file has multiple writers, even for different Markdown sections.

## Recorded transfers

- **D18 (2026-09-10, Agent 4 takeover).** Agents 2 and 3 are unavailable (session usage limits) and are therefore unable to acknowledge in their own logs; the user authorised the transfer explicitly in their place, which is the only authority that can substitute for an absent owner. Scope is strictly the two verified defects below, with browser evidence recorded in INTEGRATION_CHECKLIST. Agent 4 does not otherwise edit these owners' files, and their update logs remain theirs alone.
  - `navigation/homeSelection.ts`, `navigation/useUniverseHomeState.ts` — recorded selection resurrects on returning Home (A4-006). **Fixed and verified**; ownership stays with Agent 4.
  - `motion/useUniverseHomeMotion.ts` — progress not restored on return to Home. Transfer exercised, no working fix found, **reverted under D19**; the file is byte-for-byte Agent 2's original and the defect is reported as A4-007.

## Transfer protocol

If another owner has a file, DO NOT EDIT IT. Send a request, name exact path/export and acceptance check. For reassignment, current owner explicitly stops editing and acknowledges; new owner acknowledges; Agent 4 records the transfer in ownership and decisions. Then the new owner can edit. Until then original ownership stands. Agent 4 may fix only its own files and has no cross-file override privilege.

No Git mutations, branch switching, worktrees, `.git` repair, mass formatting or reverting others' work. Use fresh file reads to account for concurrent changes.
