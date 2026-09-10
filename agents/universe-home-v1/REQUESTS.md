# Cross-agent requests

Single writer: Agent 4. Publish requests and replies in your own `updates/agent-N.md`; Agent 4 incorporates each without changing its meaning. This is how all agents write to the shared request queue without editing the same file. When waiting, read recipients' fresh logs as well as this summary.

Use IDs A1-001, A2-001, A3-001, A4-001; never allocate from a shared counter. States: OPEN → ACKNOWLEDGED → READY FOR VERIFICATION → CLOSED (or BLOCKED). Requester confirms the acceptance check before Agent 4 closes. Silence is not acceptance of a contract change, transfer or edit freeze.

## Request template

- ID / timestamp:
- From / To:
- Exact path or export:
- Need:
- Reason / dependency:
- Proposed compatible signature or change:
- Acceptance check:
- Status:
- Response and evidence reference:

## Initial coordination requests

### PLAN-001 — Agent 3 contract publication

From: Coordinator. To: Agent 3.
Need: Publish contracts.ts and planetDestinations.ts signatures matching SHARED_CONTRACT first, then publish useUniverseHome API availability.
Reason: All roles can work independently against these declarations.
Acceptance: Consumers acknowledge signatures; no duplicate type/config definitions in production.
Status: OPEN.

### PLAN-002 — Portal and homepage activation gate

From: Coordinator. To: Agents 3 and 4 (each changes only owned files).
Need: Pair UniverseCanvas portal adaptation / legacy navigate guard with UniverseHome composition.
Acceptance: One Canvas; no legacy Earth animation on Home/Groups links; new home uses #page-content; old feed not mounted; both owners report ready before Agent 4 runtime verification.
Status: OPEN.

### PLAN-003 — Scene metrics handshake

From: Coordinator. To: Agents 1 and 2.
Need: Publish complete stable rig map, measured world spacing, resize notification and null teardown; motion tests use mock Groups meanwhile.
Acceptance: x positions match the three contract resting states and preserve progress across a sidebar width change.
Status: OPEN.

### PLAN-004 — Existing index failure

From: Coordinator. To: Agent 4.
Need: Carry the observed Git index error into final limitations; use current-file evidence when Git inspection is unavailable.
Acceptance: No agent attempts Git/index repair or attributes unverified baseline changes to another agent. User handles Git separately.
Status: OPEN; does not block independent file work.

## Agent 4 aggregation — 2026-09-10 03:14 UTC

- PLAN-001: ACKNOWLEDGED; contracts/config now exist and Agent 4 accepts signatures (A4-S02). Await consumers 1/2 publication and provider API readiness before closing.
- PLAN-002: ACKNOWLEDGED by Agents 3/4; UniverseHome composition exists, page entry remains old feed until payload/guard available. Runtime verification waits for both.
- PLAN-003: ACKNOWLEDGED by Agents 1/2; Agent 1 scene handle/spacing readiness published. Motion resting-state/resize runtime evidence pending.
- PLAN-004: CLOSED for coordination acceptance: index failure remains final limitation; no repair. Sources Agents 1/3 and A4-S01.
- A1-001: ACKNOWLEDGED by Agent 4 (A4-S01); scene browser checks scheduled after activation. Requester acceptance remains pending.
- A2-001: READY FOR VERIFICATION; shared contract/config files exist. Agent 2 must confirm production imports/type compatibility.
- A4-001: CLOSED; canonical coordination package resolved by D17 and A4-S04.
- A4-002: OPEN to existing port-3000 dev server owner/user. Need owner-controlled stop at final freeze before shared `.next` build. Agent 4 does not own existing PID 317478 and will not kill it. Acceptance: no concurrent dev/build writes; user request pending.
- A4-003: OPEN to user for existing authorized browser/session context. Fresh browser has no authentication; no credentials invented or backend records changed. Acceptance: live destination checks using an existing session, otherwise explicit BLOCKED.
- A4-004: OPEN to Agents 1/2/3 for short final source edit freeze once interfaces/local checks ready; explicitly acknowledge in own log, retain log access. Agent 4 page activation still awaits Agent 3. Details A4 owner log.
- A4-005: OPEN to Agent 2: canonical motion imports/config and nearest snap inertia review. No signature changes; verify .25/.75 nearest boundaries without velocity prediction. Details A4 owner log.
- A2-001: CLOSED after Agent 2 explicit verified reply (03:16 UTC aggregation). A4-005 remains separate nearest-snap review.
- A4-006: OPEN to Agent 3: clear recorded selection persistently after navigation, preventing route-mask state from reappearing on Home return. Repro and acceptance in A4 log; no public signature change.
- A4-004: ACKNOWLEDGED by Agents 1, 2 and 4; Agent 3 acknowledgment pending. Production sources frozen for those owners; logs/test evidence remain writable.
- PLAN-001: Published contract signatures acknowledged by Agents 1/2/4; provider API exists; Agent 3 explicit readiness pending.
- PLAN-002: Agent 4 activation READY (A4-S06), source payload/guard inspected; Agent 3 readiness reply pending before integrated runtime.
- A4-005: READY FOR VERIFICATION (Agent 4 checked canonical imports and inertia:false; owner marked verified, requester reserves browser nearest-stop verification).

03:22 UTC coordinator gate: Agents 1/2/4 have explicitly frozen production source. Agent 3 is the remaining readiness/freeze acknowledgment; its code is present, so this is a handoff dependency, not a missing-interface claim. A4-006 selection-return defect requires an owned fix/verification. Agent 4 is continuing evidence preparation; no broad checks have run.

## Agent 4 takeover aggregation — 2026-09-10 (final)

Previous Agent 4 unavailable (usage limit). Continuing existing ownership; Agents 1-3 logs untouched.

- **PLAN-001 — CLOSED.** Contracts and route config published by Agent 3 and consumed by Agents 1/2/4 with no duplicate type or config definitions. Verified: Agent 2's `DEFAULT_PLANET_ORDER` is a re-export alias of the canonical `PLANET_ORDER`, not a second definition.
- **PLAN-002 — CLOSED.** Portal payload, docking and v1 guard paired with the homepage switch. `(main)/page.tsx` mounts only `UniverseHome`; one Canvas; legacy cinematic verified inert at runtime.
- **PLAN-003 — CLOSED.** Rig map, spacing, resize notification and null teardown all confirmed in the browser; measured spacing matches Agent 1's published table.
- **PLAN-004 — CLOSED.** Git index error carried into final limitations; no repair by any agent.
- **A1-001 — CLOSED.** Scene checks run and passed (hierarchy, rotation, rings, reduced motion, resize, off-home sleep, null teardown).
- **A2-001 — CLOSED** (previous session).
- **A4-002 — CLOSED.** The user authorised stopping dev server PID 317478; `npm run build` then ran cleanly with nothing racing `.next`. The server is currently stopped.
- **A4-003 — CLOSED as no longer blocking.** The old blocker assumed the authenticated orbital feed. The v1 homepage fetches no data and returns 200 unauthenticated, so every Home/Groups check ran for real. Only `/posts` still redirects to `/login`, which is the app's own auth behaviour.
- **A4-004 — CLOSED.** All owners acknowledged the freeze; broad checks ran afterwards.
- **A4-005 — CLOSED.** Canonical imports confirmed, and `inertia:false` / `directional:false` verified in source *and* at runtime: stops at 0.24/0.26/0.74/0.76 each settled on the nearest planet regardless of approach direction.
- **A4-006 — CLOSED (fixed).** Recorded selection resurrected on returning Home. Fixed by Agent 4 under transfer D18 in `navigation/homeSelection.ts` (added `isSelectionStale`) and `navigation/useUniverseHomeState.ts` (drop the stored value instead of masking it; replace the index-ref latch with a functional dispatch). Verified: all 5 route rounds and the modified-click check now pass, having failed before.

### A4-007 — Progress is not restored on returning to Home (OPEN, owner Agent 2)

- From/To: Agent 4 -> Agent 2. Exact path: `frontend/src/features/universe-home/motion/useUniverseHomeMotion.ts`.
- **Symptom.** Focus Mars on Home, open Groups, return Home: the track resets to Earth at progress 0 instead of restoring Mars. Collapsing the sidebar at non-zero progress does the same. Reproducible in all 5 lifecycle rounds.
- **Root cause (measured, not inferred).** The saved value in `progressRef` is correct when Home unmounts. On remount the hook restores scroll *before* the trigger exists, so the browser clamps it; the trigger is then built against a scroller whose position is not yet the restored one, and its first scrubbed update reports progress 0 and writes that back over the saved value. Instrumented trace: `SETUP initial=0.500` -> `UPD ... 0.000` -> next `SETUP initial=0.000`. In React StrictMode the effect runs setup/cleanup/setup, and the second setup re-measures against the already-restored scroller, which maps the restored offset to progress 0.
- **What Agent 4 tried and reverted (D19).** Four scoped attempts: a teardown write guard, `trigger.refresh()` before restoring scroll, deferring write re-enable to the next frame, and building triggers from a zeroed scroller. Each helped in isolation, none made restoration deterministic, and the partial states could leave the scene showing Mars while the label read Earth. The lifecycle audit scored 27/32 with and without them, so they fixed nothing measurable and were reverted. **`useUniverseHomeMotion.ts` is byte-for-byte Agent 2's original.**
- **Suggested direction.** Create the ScrollTrigger first and restore scroll only after the pin spacer is laid out and ScrollTrigger has refreshed, keeping progress writes suppressed until then; make it idempotent across StrictMode's double setup, so the second pass restores from the saved value rather than re-measuring the first pass's scroll position.
- **Acceptance.** Focus Mars, visit Groups, return: `data-active-planet === "mars"`, `mars-ScrollRoot.position.x` within 0.03 of 0, and `#page-content.scrollTop` at the Mars stop, repeatably across 5 rounds and after a sidebar collapse. Re-run `integration/lifecycle-audit.mjs`; the 5 "Home restores Mars" checks must pass.
- Status: **OPEN.** Does not block the rest of the milestone.

