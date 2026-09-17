# Full Project Review — Executive Summary

> Independent Claude Sonnet 5 audit, 2026-09-17. Repository: `/home/hussain-hht/Desktop/ss2/social-network`, branch `feat/auth-regester-page`. This audit is review-only — no application code, migrations, dependencies, or the root README were modified. See `docs/project-review/` for the 11 supporting files this summary indexes.

## Review Scope

Frontend (Next.js 16/React 19/Three.js), backend (Go 1.26 stdlib), SQLite + 30 migrations, authentication/sessions/cookies, authorization/privacy across every domain (profiles, followers, posts, comments, groups, events, chat, notifications), WebSocket realtime infrastructure, the 8-planet 3D visual system, Docker/runtime configuration, test coverage, code quality, and documentation accuracy. Methodology: seven parallel deep-dive passes (backend architecture/concurrency, auth/security/privacy, database/migrations, realtime/chat/notifications, frontend, 3D/performance, code-quality/tech-debt), each tracing actual call chains and citing file:line evidence, plus direct independent verification of all build/lint/test/typecheck/compose commands and hands-on reading of the most consequential claims before they were trusted. A prior Gemini-generated handoff (`docs/ai-handoff/`) was used as a research accelerator, not as ground truth — every load-bearing claim from it was independently re-verified against current source.

## Overall Health

| Subsystem | Health |
|---|---|
| Core authorization/privacy logic | **Healthy** — the most rigorously verified area of the audit; no bypass found anywhere |
| Backend architecture (Go) | **Healthy** — clean layering, correct transactions, no concurrency bugs |
| Database schema & migrations | **Mostly Healthy** — one non-reversible migration, solid FK/uniqueness design, missing indexes |
| Realtime (WebSocket/chat/notifications) | **Mostly Healthy** — sound transport and notification logic; one real reconnect gap |
| Frontend architecture & correctness | **Healthy** — strong data-fetching/cancellation patterns; one high-impact functional bug |
| 3D/performance | **Healthy** — genuinely careful engineering; two bundle/cache optimizations pending |
| Test coverage | **Needs Attention** — solid backend integration coverage, zero frontend tests |
| Documentation | **Needs Attention** — root README and several internal docs are stale or actively wrong |
| Configuration/deployment | **Needs Attention** — works perfectly for the default local topology only |

**No subsystem is High Risk or Blocked.** This is a well-engineered student/personal project that would benefit from a focused cleanup pass, not a rescue effort.

## Requirements Compliance Snapshot

Of the requirement areas tracked in `01_REQUIREMENTS_COMPLIANCE.md`, the overwhelming majority are `PASS`. Four items require action:
- **Custom/private post visibility (`FAIL`)** — a real, silent bug: a post can be published to "specific people" with nobody actually selected, producing a post visible to no one, with a false success message. This is the exact bug the project's own developer flagged in root `TODO.md`.
- **Migration reversibility (`FAIL`)** — one down-migration (`pending_group_attempts`) provably fails under the exact data scenario its corresponding up-migration exists to support (reproduced, not theoretical).
- **Docker cross-service communication for non-default deployments (`PARTIAL`→effectively broken for the configurable case)** — the documented environment-variable override for the backend origin is dead code on the frontend side and entirely absent on the backend CORS side.
- **Private chat reliability across reconnects (`PARTIAL`)** — messages are never lost server-side, but don't reliably reappear in the live UI after a brief disconnect without a manual reload.

Every other tracked requirement — registration, sessions, profile privacy, followers, comments, groups, group chat, events, notifications, uploads — is `PASS`, including several areas (direct-post-ID access control, group-chat membership TOCTOU, notification sync races) that this audit specifically stress-tested because they are classic sources of subtle bugs in this kind of application, and found no bypass.

## Issue Counts

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 4 |
| Medium | 23 |
| Low | 30 |
| Info | 5 |
| **Total** | **62** |

Full records: `11_ISSUE_REGISTER.md`.

## Critical / High Findings

1. **`DB-001` — A migration's down-file is not actually reversible under normal data** (reproduced against a scratch DB). Affects rollback tooling only, not the running application.
2. **`WS-001` — Chat does not resync after a WebSocket reconnect.** Messages sent during a routine, brief disconnect (laptop sleep, mobile backgrounding, a wifi blip) persist correctly server-side but don't appear in the recipient's live UI without a manual reload — a state-sync gap, not data loss, but a real "chat feels broken" experience.
3. **`FE-001` — The custom/private post audience picker can be submitted with zero selected recipients**, producing a post that's silently visible to nobody with no error anywhere in the flow. This is the single most concrete, highest-confidence finding of the entire audit, because it independently corroborates a bug the project's own developer already flagged by hand in `TODO.md` — this audit found and explained the actual root cause.
4. **`DOC-001` — The frontend's backend-origin configuration is dead code**, and the backend's CORS origin has no environment override at all — despite both the Dockerfile and `compose.yaml` being built around a configurable origin. Invisible today because the default Docker topology happens to match the hardcoded fallback; would silently break the entire app (not just images) on any real, non-default deployment.

No authorization bypass, no data-corruption path, and no secret-exposure issue was found at Critical or High severity anywhere in this audit — despite specifically, adversarially stress-testing the areas most likely to hide one (direct object access across posts/comments/groups/events, the group-chat membership TOCTOU scenario, session/cookie handling, upload content validation).

## Most Important Medium Findings

- **`SEC-001`** — `/uploads/*` static media has no authorization check at all; once a restricted post/comment/event image's URL is known, it remains fetchable forever after access is later revoked (mitigated by unguessable UUID filenames).
- **`DB-002`/`DB-003`/`DB-004`** — a notification-cascade bug that deletes an unrelated user's notification history, and missing indexes that will turn into real stalls (given the single-connection SQLite design) once the app grows past dev-scale data.
- **`WS-002`/`WS-003`** — group-member removal gives no realtime signal to the removed client, and private-chat pagination can render a duplicate message under a live-arrival race.
- **`DX-003`/`TEST-001`** — the frontend has no runtime validation at its API/WebSocket data boundary and zero automated test coverage of any kind, meaning defects like `FE-001` can only be caught by manual QA or, as happened here, a developer noticing in production.

## Strong Areas

- **Authorization is the standout strength of this codebase.** Nearly every privacy-sensitive path re-derives permission from the database on every request; the group-chat membership TOCTOU scenario this audit specifically prioritized checking is correctly handled — verified independently twice.
- **Concurrency correctness**: a full `go test -race ./...` (not just the two packages a prior pass checked) passes clean across the entire backend, including the WebSocket hub and all HTTP integration suites.
- **Notification sync logic** is a genuinely well-designed, verified-sound id-keyed union merge that survives every out-of-order REST/WebSocket race this audit tested.
- **Upload security**: magic-byte content sniffing, an allow-list that excludes SVG/HTML (blocking a real stored-XSS vector), UUID filenames, redundant size enforcement.
- **3D system engineering**: correct shared-vs-owned resource disposal, a render loop that genuinely pauses when the tab is hidden or reduced-motion is active, and a true unmount (not CSS-hide) when the feature is toggled off.
- **TypeScript/Go hygiene**: zero `as any`, zero `@ts-ignore`, zero `TODO`/`FIXME`/`HACK` comments anywhere in either codebase — unusually clean for a project this size.

## Risk Hotspots

Git-churn analysis shows `backend/internal/router/{router,dependencies}.go` and the `groups` feature (backend and frontend) as the most frequently modified areas of the codebase — consistent with `groups` also being the largest, least-decomposed package (`backend/internal/groups/handler.go` at 1156 lines) and the area carrying the most outstanding existence-oracle findings (`SEC-004`). This is a reasonable place to focus any future refactoring effort, both because it's evidently where active development concentrates and because it's already showing the maintainability strain of that concentration.

## Findings Beyond the Gemini Audit

- **Systemic staleness in `docs/backend_docs/`** (`DOC-003`): the prior audit flagged only `frontend/README.md`, `docs/TEST_AUDIT_REPORT.md`, and the root `README.md` as stale. This audit found that the detailed, technical, file:line-citing docs in `docs/backend_docs/` — specifically `websocket-system.md` (which asserts in bold that live chat sending "does not work end to end") and `notifications.md` (which claims Follow Requests and Group Events "don't exist") — are themselves significantly out of date, and verified both claims false against current code. This is a more dangerous form of drift than an obviously-old planning doc, because the writing style invites trust without re-verification.
- **The actual root cause of the developer's "private post is not work" complaint** (`FE-001`): the prior audit's caveat list noted only that the custom-viewer picker shows an unhelpful empty state for users with zero followers. This audit traced further and found the real, more damaging bug underneath — a completely missing submission guard that lets a custom post be published with no audience at all.
- **The configurable-backend-origin plumbing is dead, not just undocumented** (`DOC-001`): the prior audit's caveat listed this as "frontend hardcodes localhost," implying it as a static design fact. This audit traced it further and found it's actually a *partially removed* feature — the Dockerfile/compose/doc-comment all still expect it to work, and the removed implementation's helper functions are still sitting unused in the file, flagged dead by the linter.
- **A real, reproduced migration-reversibility failure** (`DB-001`), verified empirically rather than by static reading — the prior audit's migration coverage did not flag this.
- **Missing FK indexes and a full-scan on the main feed query** (`DB-003`/`DB-004`), verified via `EXPLAIN QUERY PLAN` against the live database rather than inferred from the schema alone.

## Gemini Findings Independently Confirmed

- Frontend hardcodes `localhost:8080`/backend hardcodes `localhost:3000` (re-confirmed, and extended — see above).
- `frontend/README.md`'s "group chat is a disabled placeholder" and "3D is dormant" claims are false (re-confirmed by direct file-count/grep evidence, not just trusted).
- `docs/TEST_AUDIT_REPORT.md` is a stale historical snapshot (re-confirmed: dated 2026-09-06, claims Docker doesn't exist anywhere in the repo, among many other now-false `NOT IMPLEMENTED` claims).
- The root `README.md`'s backend entrypoint path is wrong (re-confirmed, and the full scope of the drift — migration naming scheme, package list, entire frontend structure — is substantially larger than the single line item previously flagged).
- `schema.dbml`'s 4 flagged drift items are all real (re-confirmed by direct migration inspection; 10 further drift items were found beyond the original 4).
- All backend tests/build/vet pass clean (re-confirmed, and extended: this audit ran the race detector across the *entire* suite, not just two packages).

## Recommended Next Step

Start with `12_RECOMMENDED_ACTION_PLAN.md` Phase 1: fix `FE-001` (the custom-post bug), `DB-001` (the migration), and `DOC-001` (the dead config plumbing) first — all three are small, low-risk, independent changes with outsized user/developer impact, and one of them closes a bug the project owner has been living with. Everything else in this audit can proceed in parallel afterward; nothing here blocks anything else.

## Verification Commands Run

`go build ./...`, `go vet ./...`, `go test -count=1 ./...`, `go test -race -count=1 ./...` (full suite, ~4 min), `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build -- --webpack`, `docker compose config` — all passed with 0 errors (3 pre-existing lint warnings, all independently explained — see `08_TESTING_RUNTIME_REVIEW.md`).

## Application Code Changed

**No.** Root README changed: **No.** All intentional changes from this audit are confined to `docs/project-review/`.
