# 08 — Testing & Runtime Review

> Independent Claude audit pass. All commands below were re-executed live during this audit (2026-09-17) from a clean, unmodified working tree (see `00_EXECUTIVE_SUMMARY.md` for the exact starting `git status`). Exit codes and output are reproduced verbatim/abridged. This independently reproduces (and in the race-detector case, extends) the prior Gemini handoff's `VERIFICATION_LOG.md`.

---

## 1. Verification Command Results

| # | Command | Working Dir | Exit Code | Result |
|---|---|---|:--:|---|
| 1 | `go build ./...` | `backend/` | 0 | Clean compile, all binaries (`cmd/server`, `cmd/migrate`, `cmd/seed`) and internal packages. |
| 2 | `go vet ./...` | `backend/` | 0 | No vet warnings. |
| 3 | `go test -count=1 ./...` | `backend/` | 0 | 16 tested packages pass, 0 failures. See §2 for the full package list. |
| 4 | `go test -race -count=1 ./...` | `backend/` | 0 | **Full suite** (not just `bucket`/`middleware` as in the prior handoff) passes clean under the race detector, ~4 min wall time. No data races detected anywhere, including `tests/chat`, `tests/groups`, `tests/notifications`. |
| 5 | `npm run lint` (eslint) | `frontend/` | 0 | 0 errors, 3 warnings (see §3). |
| 6 | `npx tsc --noEmit --incremental false` | `frontend/` | 0 | 0 type errors. |
| 7 | `npm run build -- --webpack` | `frontend/` | 0 | Production build succeeds; 16 routes generated (7 static `○`, 4 dynamic `ƒ`, matching the App Router segment map). |
| 8 | `docker compose config` | repo root | 0 | `compose.yaml` parses; two services (`backend`, `frontend`), confirms build args and volume wiring (see `10_DOCUMENTATION_CONFIG_REVIEW.md` for a substantive finding about those build args). |

**Verdict: the codebase is in a genuinely buildable, testable, lintable, type-safe state.** This is a real strength — see `00_EXECUTIVE_SUMMARY.md`.

### 1.1 Improvement over the prior (Gemini) verification pass

The Gemini handoff's `VERIFICATION_LOG.md` only ran `go test -race` against `./tests/bucket/... ./tests/middleware/...` (the two packages judged most concurrency-sensitive). This audit ran `go test -race ./...` against the **entire** module, including the WebSocket hub (`internal/websocket`), chat, groups, notifications, and posts integration suites — all of which spawn concurrent goroutines/HTTP test servers. All passed clean. This is stronger evidence than the prior pass that the hub/rate-limiter/session-store concurrency primitives are race-free under Go's happens-before model, though the race detector only catches races on paths actually exercised by the tests — see `TEST-001` in the issue register for what those tests do *not* exercise (raw concurrent WebSocket client fan-out).

---

## 2. Backend Test Inventory & Feature Coverage Matrix

All backend tests live under `backend/tests/<domain>/` as black-box integration tests (spin up a real `httptest` server + real SQLite file), **not** as `_test.go` files colocated with the source in `internal/<domain>/` (the only colocated tests are `internal/config/config_test.go` and `internal/websocket/hub_test.go`). This is a deliberate, consistent pattern — see `09_CODE_QUALITY_TECH_DEBT.md` for whether that's a net positive or a gap (it means no fast unit tests for pure business-rule functions in isolation; every test pays the cost of a full HTTP round trip).

| Feature | Test Dir | # Test Files | Type | Notes / Gaps |
|---|---|:--:|---|---|
| Auth (register/login/logout/session) | `tests/auth/` | 3 | Integration (HTTP) | Covers registration validation, login, session cookie behavior. |
| Rate limiting | `tests/bucket/` | 2 | Integration + concurrency | Explicitly race-tested. |
| Private chat | `tests/chat/` | 1 | Integration (HTTP) | See `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md` — confirm whether this exercises the live WebSocket send path or only `GetHistory`/HTTP endpoints; no dedicated `tests/` directory for **group chat** specifically (it lives under `tests/chat/` or `tests/groups/` — verify placement). |
| Comments | `tests/comments/` | 1 | Integration | |
| DB/migrations | `tests/db/sqlite/` | 1 | Integration | Confirms migration runner behavior, not necessarily every individual up/down pair — see `04_DATABASE_MIGRATIONS_REVIEW.md`. |
| Followers | `tests/followers/` | 2 | Integration | |
| Groups | `tests/groups/` | 2 | Integration | Largest single suite by wall time (54s under `-race`), suggesting broad coverage of join/invite/event flows. |
| Likes | `tests/likes/` | 1 | Integration | |
| Middleware | `tests/middleware/` | 1 | Integration + concurrency | Explicitly race-tested. |
| Notifications | `tests/notifications/` | 1 | Integration | Per `docs/backend_docs/websocket-system.md` §11, includes a real `httptest.Server` + `gorilla/websocket` client asserting live delivery — a genuinely valuable integration test pattern, worth replicating for chat (see `TEST-001`). |
| Posts | `tests/posts/` | 1 | Integration | |
| Profile | `tests/profile/` | 2 | Integration | |
| Search | `tests/search/` | 1 | Integration | |
| Share | `tests/share/` | 1 | Integration | |
| Upload | `tests/upload/` | 1 | Integration | |
| `internal/websocket` (hub) | `internal/websocket/hub_test.go` | 1 | Unit + concurrency | `TestHubConcurrentSend`: 100 goroutines × `Broadcast`/`SendToUser` over 50 registered clients with `nil` connections (map bookkeeping only, not real socket I/O). |
| `internal/config` | `internal/config/config_test.go` | 1 | Unit | |

**No dedicated test directory exists for**: Group Events (RSVP flows — likely folded into `tests/groups/`, needs confirmation), Group Chat specifically as distinct from 1-on-1 chat, and the WebSocket inbound-router wiring itself (`wsRouter.Register` dispatch table) end-to-end for chat events specifically — see `TEST-001`.

## 3. Frontend Test Inventory

**There is no frontend automated test infrastructure at all.** Confirmed by:
- `package.json` (`frontend/`) declares no `jest`, `vitest`, `playwright`, `@testing-library/*`, or `cypress` dependency of any kind (see full dependency list in `10_DOCUMENTATION_CONFIG_REVIEW.md`).
- No `*.test.ts(x)` or `*.spec.ts(x)` files exist anywhere under `frontend/src/`.
- The one test-shaped script, `"test:smoke": "bash tests/run-smoke.sh"`, points at a file that does not exist — `frontend/tests/` is not present in the repository at all. Running it fails immediately: `bash: tests/run-smoke.sh: No such file or directory` (reproduced live during this audit).
- `frontend/README.md` describes this smoke script in detail (Playwright + Chromium, tests "real routes, uploads, comments, groups/events, invitations, followers, private messages, notifications, mobile layouts, and reduced motion") as if it exists and is part of the standard validation flow (`npm run lint && npm run build && npm run test:smoke`) — this is actively misleading documentation, not just an omission. See `DOC-001` in the issue register.

**Frontend lint warnings (3, all non-blocking):**
1. `frontend/src/features/interactions/components/PostSharePreview.tsx:58` — `<img>` instead of `next/image` (LCP warning).
2. `frontend/src/lib/api.ts:9` — `DEFAULT_BACKEND_ORIGIN` declared, never used.
3. `frontend/src/lib/api.ts:11` — `cleanOrigin` declared, never used.

Findings #2 and #3 are not cosmetic lint noise — they are dead code that is the smoking gun for a real configuration defect. See `DOC-001`/`DX-001` in the issue register and `10_DOCUMENTATION_CONFIG_REVIEW.md` §1 for the full trace (the unused variables are leftover from an env-var-driven backend-origin resolution that was apparently removed, while the Docker build-arg plumbing that was supposed to feed it was not).

## 4. Test Gap Analysis (per Critical/High findings)

This section is populated after the parallel subsystem audits land and Critical/High findings are finalized in `11_ISSUE_REGISTER.md`; each such finding there carries its own "Could a test have caught this?" note. Structurally, the two gap categories already evident from this pass alone:

- **No frontend tests of any kind** means every frontend-only defect in this audit (React correctness, form validation, accessibility, responsive layout, 3D lifecycle) is, by definition, currently only caught by manual QA or not at all.
- **Backend tests are exclusively HTTP-level integration tests**, which is a reasonable choice for an API-shaped project, but means: (a) no fast unit coverage of pure logic (e.g. privacy-rule evaluation, rate-limiter math) in isolation from the DB/HTTP stack, and (b) anything that only manifests over a **live, bidirectional WebSocket connection with two concurrent clients** (e.g. a TOCTOU membership-revocation race, or duplicate-delivery on reconnect) is unlikely to be exercised by the existing suite, which per `docs/backend_docs/websocket-system.md` §11 explicitly does not cover `chat.Service.HandleIncomingWSMessage` end-to-end over a real socket the way the notifications test does.

## 5. Runtime / Live Smoke Testing

Live `docker compose up` / manual click-through testing of golden-path flows (register → login → post → follow → group → chat → notification) was **not performed** in this pass — see `12_RECOMMENDED_ACTION_PLAN.md` for why (risk of mutating the only local SQLite dev database, and the audit brief's preference for static/code-path verification over live mutation where static tracing is sufficient). Findings that would benefit from live runtime confirmation are explicitly marked `Status: Needs Runtime Verification` in `11_ISSUE_REGISTER.md` rather than asserted as `Confirmed`.
