# 12 — Recommended Action Plan

> No fixes were implemented as part of this audit. This is a proposed, dependency-ordered sequence for a follow-up implementation pass. Phases are ordered by risk/impact, not by file location — several phases can run in parallel once Phase 0/1 land, since most issues in this register are independent of each other (deliberately — see `11_ISSUE_REGISTER.md`'s deduplication notes for the handful that share a root cause).

---

## Phase 0 — Critical Blockers

**None.** No Critical-severity issue was found anywhere in this audit. This is itself worth stating plainly in `00_EXECUTIVE_SUMMARY.md`: the project has no showstopper.

---

## Phase 1 — Requirements Failures (user-visible, developer-acknowledged)

These directly fail a stated requirement and, in one case, match a bug the project's own developer has been carrying in `TODO.md`. Fix first — highest ratio of user impact to implementation effort.

### 1.1 Fix the silent zero-recipient custom post (`FE-001`)
- **Why now:** Directly matches the developer's own unresolved bug report; currently produces posts that are silently broken with a false success message — the worst possible failure mode for a user-facing feature.
- **Dependencies:** None.
- **Scope:** Small (two frontend submit-guard additions + one backend validation addition).
- **Risk of change:** Low (pure additive validation, no existing behavior removed).
- **Recommended agent/model:** A focused frontend+backend implementation pass; no architectural judgment calls needed, the fix is fully specified in `02_FRONTEND_REVIEW.md` §1.

### 1.2 Fix the `pending_group_attempts` down-migration (`DB-001`)
- **Why now:** A requirements-list line item ("matching `.down.sql` migrations") is demonstrably false today; low effort to fix or explicitly document as one-way.
- **Dependencies:** None. Does not affect the running application (only rollback tooling).
- **Scope:** Small.
- **Risk of change:** Low if scoped to "document as one-way"; Medium if scoped to "make genuinely reversible" (requires a history-collapsing strategy that needs product sign-off on what to keep).
- **Recommended agent/model:** Backend-focused; the exact reproduction and two fix options are specified in `04_DATABASE_MIGRATIONS_REVIEW.md` §1.

### 1.3 Make the configurable backend origin actually work (`DOC-001`)
- **Why now:** Currently the Docker/deployment story silently only works in one exact topology despite the tooling implying otherwise — this blocks any real (non-single-host) deployment, and the fix is a restoration of dead code that already exists in the file.
- **Dependencies:** None.
- **Scope:** Small (the removed implementation's pieces — `DEFAULT_BACKEND_ORIGIN`, `cleanOrigin` — are still present in `lib/api.ts`, just unused).
- **Risk of change:** Low — the current hardcoded values become the fallback default, so default-topology behavior is unchanged.
- **Recommended agent/model:** Single frontend file + one backend config read; straightforward.

---

## Phase 2 — Security / Authorization

No Critical/High authorization-bypass issue exists (this was the single most rigorously verified area of the audit). These are real, worth doing, but not urgent in the way Phase 1 is.

### 2.1 Gate `/uploads/*` or explicitly document it as public (`SEC-001`)
- **Dependencies:** Product decision needed on which option (authenticated proxy vs. documented tradeoff) — flag for the project owner before implementation.
- **Scope:** Medium if proxying (requires re-running access checks per file type); Small if just documenting.
- **Risk:** Medium if proxying (changes response headers/caching behavior for all media).

### 2.2 Fix the 403-vs-404 existence oracles (`SEC-003`, `SEC-004`)
- **Dependencies:** None; same shape of fix across posts/comments/groups mutation endpoints — do as one coordinated pass since the fix pattern is identical everywhere.
- **Scope:** Medium (touches multiple service-layer functions across 3 packages).
- **Risk:** Low (adds a check before an existing check; strictly narrows what's currently exposed).

### 2.3 Restrict WebSocket `CheckOrigin` to match REST CORS (`SEC-002`)
- **Scope:** Small.
- **Risk:** Low, but verify no legitimate dev workflow (e.g. a separate dev-tools origin) currently relies on the permissive check before tightening.

### 2.4 Lower-priority auth hardening (`AUTH-001` through `AUTH-005`)
- Case-insensitive usernames, generic registration-conflict message, `CookieSecure` env override, drop `GET` from logout, fix the session-creation race — all independent, all Low/Medium, can be batched into one auth-hardening pass.
- **Scope:** Medium as a batch, Small individually.
- **Risk:** Low, except the username-case-sensitivity fix, which needs a data migration plan for any pre-existing case-colliding accounts (unlikely at current scale, but check first).

---

## Phase 3 — Runtime Correctness (Realtime state-sync)

### 3.1 Add WebSocket-reconnect resync to chat (`WS-001`)
- **Why now:** High severity, routine trigger condition (any brief network drop), directly undermines user trust in the chat feature ("messages disappear").
- **Dependencies:** None — the correct pattern already exists in the same codebase (`useNotificationSync`) to copy from.
- **Scope:** Medium (touches `useChat` and `useGroupChatMessages`).
- **Risk:** Low-Medium — must merge/dedupe correctly against in-flight state rather than naively replacing it, to avoid a regression that clobbers a message received during the resync fetch itself.

### 3.2 Broadcast a removal signal on group-member removal (`WS-002`)
- **Dependencies:** Best done alongside 3.1 since both touch the same frontend files.
- **Scope:** Small-Medium (one new event type, one backend broadcast call, one frontend handler).
- **Risk:** Low.

### 3.3 Fix private-chat pagination dedup (`WS-003`)
- **Dependencies:** None; the correct pattern (`deduplicateAndSortMessages`) already exists in group chat to port over.
- **Scope:** Small.
- **Risk:** Low.

---

## Phase 4 — Data Integrity (Database)

Independent of Phases 1-3; can run in parallel. Ordered here by blast radius.

### 4.1 Add missing indexes (`DB-003`, `DB-004`, `DB-010`)
- **Scope:** Small (pure `CREATE INDEX` migrations, additive, no data risk).
- **Risk:** Very low — indexes can be added without touching existing data or application code.
- **Recommended first**, since it's the lowest-risk, highest-clarity win in the whole register.

### 4.2 Fix `notifications.actor_id` cascade behavior (`DB-002`)
- **Scope:** Small (one migration changing `ON DELETE CASCADE` to `ON DELETE SET NULL` — requires a table rebuild in SQLite since FK actions can't be altered in place; standard "create new table, copy, swap" migration pattern).
- **Risk:** Medium — touches live data via table rebuild; test thoroughly against a copy of production data first.

### 4.3 Fix the session-creation race (`DB-005`/`AUTH-005`)
- **Scope:** Small-Medium (add a `UNIQUE(user_id)` constraint + switch to an upsert).
- **Risk:** Medium — changing `sessions` semantics from "one row possibly duplicated" to "exactly one row" needs a decision on how to handle any pre-existing duplicate rows during migration.

### 4.4 Standardize timestamp formatting (`DB-006`)
- **Scope:** Medium (touches every explicit `time.Now()` binding site across several packages, plus the one raw-sort query).
- **Risk:** Low if done as "always call `.UTC()`" going forward; existing mixed-format rows remain mixed but are still correctly comparable via `datetime()` wrapping, so this can be done incrementally without a backfill.

### 4.5 Add pagination to unbounded queries (`DB-008`)
- **Scope:** Small per endpoint, Medium as a batch of 4.
- **Risk:** Low, but confirm no existing frontend code assumes an unbounded result (unlikely, but check `GetFollowers`/`GetFollowing`/`GetGroupMembers`/`ListCommentsByPost` call sites first).

### 4.6 Regenerate or retire `schema.dbml` (`DB-007`)
- **Scope:** Small if scripted off `sqlite_master`/`PRAGMA table_info`; Medium if hand-updated.
- **Risk:** None (documentation only).

---

## Phase 5 — Realtime Reliability (remaining polish)

- `WS-004` (timestamp precision drift), `WS-005` (redundant broadcast), `WS-006` (typing-timer cleanup), `WS-007` (TS type accuracy) — all Low/Info, all independent, batch into a single realtime-polish pass alongside Phase 3.

---

## Phase 6 — Frontend Correctness

### 6.1 Fix destructive-modal accessibility (`FE-003`, `FE-004`)
- **Why:** Guards the two most destructive actions in the app (remove member, delete group).
- **Dependencies:** None; the correct implementation (`ConfirmDialog`) already exists to consolidate onto.
- **Scope:** Small-Medium.
- **Risk:** Low.

### 6.2 Remaining Low-severity frontend items (`FE-005` through `FE-007`)
- Batch together: group-cache lifecycle, CSS truncation fix, `<a>`→`next/link`.
- **Scope:** Small.
- **Risk:** Very low.

---

## Phase 7 — Performance (3D/bundle)

### 7.1 Code-split the 3D Canvas (`3D-001`)
- **Scope:** Small (one `next/dynamic` wrapper; the component already self-gates on client-readiness, so this should be a no-behavior-change change).
- **Risk:** Low — verify no SSR-dependent behavior is accidentally relied upon (unlikely given the component's own client-gating).

### 7.2 Add GLTF cache eviction (`3D-002`)
- **Scope:** Small.
- **Risk:** Low, but verify the "keep the currently-displayed planet's assets" logic doesn't race with the existing swap-on-ready pattern (`PlanetAssetGate`/`displayedPlanetId`) — evict only the *previous* planet, not the incoming one, after the swap completes.

### 7.3 Backend HTTP/error-handling cleanup (`BE-001`, `BE-002`, `BE-003`, `BE-007`)
- **Scope:** Medium as a batch (touches many handler files, but each change is mechanical).
- **Risk:** Low — these are consistency fixes (add a header, use a fixed error string, add a periodic sweep), not behavior changes to the happy path.

---

## Phase 8 — Tests

### 8.1 Stand up a minimal frontend test harness and write a regression test for `FE-001` (`TEST-001`)
- **Why now (not earlier):** Once `FE-001` is fixed (Phase 1), lock in the fix with a test before moving on — prevents regression.
- **Scope:** Medium (harness setup is the bulk of the work; Vitest + Testing Library is the lowest-friction fit given the existing Next.js/TS toolchain).
- **Risk:** Low.
- **Recommended agent/model:** A dedicated setup pass, since choosing/configuring a test runner is a one-time architectural decision worth getting right rather than delegating piecemeal.

### 8.2 Add a WebSocket reconnect-resync integration test (backend or frontend) (`TEST-001`, cross-ref `WS-001`)
- **Scope:** Medium — needs either a frontend integration test with a mock WS server, or a backend test asserting the persistence/delivery contract `WS-001`'s fix depends on.
- **Risk:** Low.

### 8.3 Thicken `search` package test coverage (`TEST-002`)
- **Scope:** Small.
- **Risk:** Low.

---

## Phase 9 — Technical Debt

Lowest urgency; batch opportunistically alongside other phases touching the same files rather than as a dedicated pass.

- `DX-001`/`DX-002` (duplicated clamp logic) — do alongside Phase 4's query work.
- `DX-003` (unvalidated network-response type assertions) — larger architectural decision (introduce a schema-validation library); recommend a scoping discussion before committing effort, given it touches the single shared API client used everywhere.
- `DX-004`/`DX-005` (duplicated constants/helpers) — do alongside Phase 6.
- `BE-004`/`BE-005`/`BE-006` (god files, dead method-check code, dead `pkg/response`) — do alongside Phase 7.3's handler cleanup, since they touch the same files.
- `BE-009` (no goroutine panic recovery) — small, isolated, no dependencies; worth doing early despite being "tech debt" since it's a real (if unlikely) full-server-crash risk. Consider promoting to Phase 2 if the team has any exposure to untrusted WebSocket clients.

---

## Phase 10 — Documentation

Do last, after the fixes above land — otherwise the documentation would need to be rewritten twice.

- Rewrite root `README.md` from the actual current tree (explicitly out of scope for *this* audit, per its brief — flagged here as the next agent's task).
- Correct or remove the false claims in `frontend/README.md` (`DOC-002`).
- Add "stale — verify against current code" banners to (or regenerate/prune) `docs/backend_docs/websocket-system.md` §9/§12, `docs/backend_docs/notifications.md`'s "not yet" rows, and `docs/TEST_AUDIT_REPORT.md` wholesale (`DOC-003`).
- Regenerate or retire `schema.dbml` (`DB-007`, also listed in Phase 4.6 — one task, counted once).
- Correct `MODEL_ASSETS.md`/`docs/3d-model-optimization-report.md`'s phantom-asset and stale-size claims (`DOC-005`).
- Add a `.env.example` reflecting what `config.Config` actually reads from the environment today (`DOC-004`).

---

## Sequencing Summary

```
Phase 0 (none) → Phase 1 (user-visible + developer-acknowledged bugs, small/low-risk)
                     ↓
        ┌────────────┼────────────┬─────────────┐
        ↓            ↓            ↓             ↓
   Phase 2         Phase 3      Phase 4      Phase 6/7
  (security)     (realtime)   (database)   (frontend/perf)
        └────────────┴────────────┴─────────────┘
                     ↓
              Phase 5 (realtime polish, small)
                     ↓
              Phase 8 (tests — lock in Phase 1/3 fixes)
                     ↓
              Phase 9 (tech debt, opportunistic)
                     ↓
              Phase 10 (documentation, last)
```

Phases 2, 3, 4, and 6/7 have no cross-dependencies on each other and can be worked in parallel by separate implementation passes once Phase 1 is merged.
