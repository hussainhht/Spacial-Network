# 09 — Code Quality & Technical Debt Review

> Scope: `backend/` (~16.3k non-test LOC, ~6.2k test LOC) and `frontend/src/` (~23.2k LOC). Breadth-over-depth sweep — other files in this audit cover each subsystem's functional correctness in depth; this file covers dead code, duplication, structural smells, magic values, TypeScript hygiene, silent-failure patterns, TODO classification, and test-coverage inventory.

## Top-Line Findings

1. **`DOC-001`** (High-impact, cross-referenced in `10_DOCUMENTATION_CONFIG_REVIEW.md` and `05_AUTH_SECURITY_PRIVACY_REVIEW.md`) — the frontend's API/WebSocket base-URL resolution silently ignores its own documented env-var override, and the backend CORS origin has no override at all. One root cause, evidenced across four files; not re-litigated here.
2. **`DX-001`** — pagination-clamp logic duplicated 3x in Go with a real behavioral quirk (not just style).
3. **`DX-002`** — the `search` package duplicates its default/max-limit constants in the repository layer with a *different, looser* value than the service layer declares.
4. **`DX-003`** — systemic unvalidated type assertions on network data at the frontend's single shared API/WS boundary.
5. Frontend has **zero test infrastructure** of any kind.

---

## 1. Dead Code

### Backend — confirmed-unused exported symbols (Info, unless noted)

Each verified by grepping the identifier across the entire `backend/` tree (including tests); each has exactly one match, its own definition.

| Symbol | Location | Note |
|---|---|---|
| `GetUpgrader()` | `internal/websocket/client.go:30` | Wraps the package-level `upgrader` var; the real call site (`handler.go:32`) uses the var directly, bypassing this getter entirely. |
| `(*Service) HandleIncomingWSMessage` | `internal/chat/service.go:69` | Generic event-dispatch method; `RegisterWSRoutes` wires the four handlers individually instead — looks like a leftover from an earlier single-entry-point design. |
| `(*Repository) InsertEvent` | `internal/groups/event_repository.go:8` | Thin wrapper around `InsertEventWithImage`; nothing calls the wrapper, only the wrapped function directly. |
| `JsonResponse` (whole `pkg/response` package) | `pkg/response/json.go:8` | Unused — see `BE-006` in `03_BACKEND_REVIEW.md`. ~370 call sites hand-roll the same logic instead. |
| `UpdateSessionToken` | `pkg/session/session.go:19` | Unused session-cookie helper; `auth/handler.go` hand-rolls the same `http.SetCookie` construction twice instead (`DX-005`). |

No other unused-symbol candidates surfaced from a full identifier-usage pass over ~314 exported Go functions.

### Backend — misplaced file

`backend/internal/posts/notes.txt` — legitimate, well-written API documentation (endpoint list, visibility rules, feed-filter semantics) but lives inside the Go package directory instead of `docs/`. The only `.txt` file anywhere under `backend/internal`. Low severity, misplaced not dead. No `.bak`/`.old`/stray-copy files found anywhere under `backend/` or `frontend/src/`.

### Frontend — no dead files found (Info, positive)

Every non-`page.tsx`/`layout.tsx`/`route.ts` component/hook/util was checked for at least one import reference elsewhere; every `.module.css` was checked for at least one filename reference. **No orphaned CSS modules, no dead component/hook/util files found.** Two files that initially looked unreferenced (`features/group-chat/index.ts`, `lib/utils/index.ts`) are barrel files consumed via directory-path imports — confirmed used, not false dead code. Per root `TODO.md`, two dead-code cleanup items ("remove posts app page", "remove any components not use") are already checked off and consistent with what this sweep found — no leftover directories from removed functionality (e.g. `app/(main)/posts/*` routes are all live and routed).

---

## 2. Duplication

### DX-001 — Pagination-clamp logic duplicated 3x in Go with a real behavioral edge case

**Severity:** Medium · **Confidence:** High

The same `if limit<=0 || limit>MAX { limit = DEFAULT }` shape is independently written three times with three different literal pairs — `chat.GetPrivateHistory` (`>50 → 10`), `chat.GetGroupHistory` (`>50 → 20`), `followers.GetEligibleChatContacts` (`>100 → 20`) — and in all three, a limit *above* the max collapses all the way to the small default rather than clamping to the max. Contrast with `search/service.go`, which correctly separates the two cases (`<=0`→default, `>max`→max). Not a security issue (fails toward under-fetching), but a genuine logic inconsistency duplicated three times instead of living in one shared helper — exactly the kind of thing that gets "fixed" at one call site during a future bug report and left wrong at the other two. Cross-referenced as `DB-012` (query-quality angle) in `04_DATABASE_MIGRATIONS_REVIEW.md` — **one root cause, counted once in the issue register.**

### DX-002 — `search` package duplicates its limit constants in the repository layer with a looser value than the service layer declares

**Severity:** Medium · **Confidence:** High

`search/service.go` declares `DefaultLimit=10`, `MaxLimit=50`, and `Service.Search` correctly clamps against them. But `search/repository.go` reimplements the identical clamp **four times** (`SearchUsers`, `SearchGroups`, and two more) using bare literals — `if limit<=0 { limit=10 } else if limit>100 { limit=100 }` — where `100` does not match the service's `MaxLimit=50`. Currently unreachable via the HTTP handler (the service always clamps first), but it means the repository's own exported methods have a silently different, looser ceiling than the one documented/enforced at the service layer — live in the exported API for any future caller (an admin endpoint, a test, a different service). **Fix:** reference `search.MaxLimit`/`DefaultLimit` from the repository instead of re-declaring the literals.

### Info — Things checked and confirmed NOT duplication problems

- **Text validation** (`SanitizeText`/`TextRules`) is genuinely centralized in `internal/validation/` and reused correctly by every domain package that needs it.
- **Multipart body-size constants** (`maxNewPostRequestSize`, `maxCreateEventRequestSize`, etc.) look like duplicated magic numbers at first glance but are each a distinct, commented, intentionally-sized outer HTTP-body cap consistent with the shared per-file `config.MaxMediaSize`/`MaxAvatarSize` — no drift found.
- **Content-length constants** (`posts.MaxContentLength=10000`, `comments.MaxContentLength=2000`, `chat.MaxMessageLength=2000`, `share.MaxNoteLength=1000`) are distinct, intentional per-domain values, and every frontend `maxLength` counterpart matches its backend limit exactly.
- **localStorage keys**: only two features use `localStorage` at all, each defining its own key(s) once as local module constants — not scattered.
- **Frontend pagination-size constants** (`PAGE_SIZE`, `HISTORY_PAGE_SIZE`, etc.) are each a distinct, locally-scoped value for a distinct UI surface, not one rule copy-pasted repeatedly.

### DX-004 — Avatar/photo max-size constant re-declared 4 times; the one shared, more-correct helper is unused

**Severity:** Low (drift-risk) · **Confidence:** High

`frontend/src/lib/upload.ts` exports `MAX_IMAGE_SIZE = 5*1024*1024` alongside `validateImageFile()`, which sniffs actual magic bytes (not just `file.type`) — written, per its own comment, to "mirror the backend's allow-list." Nothing outside `upload.ts` imports it. Instead, `RegisterForm.tsx`, `ProfileAvatarForm.tsx`, and `CreateGroupForm.tsx` each hand-roll their own `MAX_AVATAR_SIZE`/`MAX_GROUP_PHOTO_SIZE` constant and a weaker `file.type`-based allow-list (`file.type` is attacker/browser-controlled and can be spoofed or empty — `validateImageFile`'s magic-byte approach is strictly more correct). All four numbers currently agree with each other and with the backend's `config.MaxAvatarSize`, so this is Low today — but it's four independent copies of one business rule, one of which is the strictly-worse implementation, sitting next to the correct shared one. **Fix:** import `validateImageFile`/`MAX_IMAGE_SIZE` in all three forms instead of re-declaring.

### DX-005 — Session cookie construction duplicated instead of using the existing (dead) helper

**Severity:** Low · **Confidence:** High

`pkg/session/session.go`'s `UpdateSessionToken` builds/sets a session cookie with the correct field set (`Path`, `HttpOnly`, `SameSite=Lax`, `Secure`) — but is dead code (§1). `auth/handler.go` instead hand-rolls the identical `http.SetCookie` construction inline, twice (`LoginHandler`, `LogoutHandler`). Fields agree today; same "helper exists, unused, logic duplicated instead" shape as `DX-004`.

---

## 3. File Size / Structure Smells

Top of a repo-wide `wc -l` sweep across `.go`/`.ts`/`.tsx`:

| Lines | File |
|---|---|
| 1156 | `backend/internal/groups/handler.go` |
| 1027 | `backend/internal/seed/seed.go` |
| 654 | `backend/internal/posts/handler.go` |
| 619 | `frontend/.../CreateGroupForm.tsx` |
| 615 | `backend/internal/groups/repository.go` |
| 610 | `frontend/.../ProfilePage.tsx` |
| 579 | `frontend/.../RegisterForm.tsx` |
| 561 | `backend/internal/followers/repository.go` |
| 530 | `frontend/.../SettingsPage.tsx` |

`groups/handler.go` (1156 lines, 20 HTTP handlers, cross-referenced as `BE-004` in `03_BACKEND_REVIEW.md`) is the clearest "god handler" — one file owns group CRUD, membership, join requests, *and* invitations. Notably, the **events** sub-domain of the same package is already correctly split into `event_handler.go`/`event_repository.go`/`event_service.go`/etc. — proving the team already knows and uses this pattern within the very same package, just hasn't applied it back to the base `handler.go`.

`backend/internal/seed/seed.go`'s `Run()` is a single **~913-line function** with no internal decomposition (confirmed: no nested helper functions inside it). Dev/seed-only code (lower blast radius than request-handling code), but a 900-line undecomposed function is a genuine smell regardless of context. Low-Medium.

Several frontend `*Page.tsx`/`*Form.tsx` files exceed 400-600 lines (`CreateGroupForm.tsx`, `ProfilePage.tsx`, `RegisterForm.tsx` — some size inherent to a multi-step wizard, `SettingsPage.tsx`) — worth a mention as a pattern, not flagged individually in depth; would benefit from extracting sub-sections into child components the way `GroupPanels.tsx` already splits into `events/`/`overview/`/`management/` sub-structure.

Backend package/file structure is otherwise consistent — every domain follows `handler.go`/`service.go`/`repository.go`/`model(s).go`/`validation.go`/`errors.go`. Frontend `features/*` structure (`api/`, `components/`, `hooks/`, `types/`, occasionally `context/`/`constants/`/`utils/`/`adapters/`) is consistently applied across all 12 feature directories.

**Info:** `backend/internal/posts/model.go` (singular) vs. `backend/internal/chat/models.go` (plural) — same role, inconsistent pluralization across packages.

---

## 4. Magic Values

### DOC-001 (cross-reference) — Hardcoded `localhost` in production-relevant config, with inconsistent override support

Full detail in `10_DOCUMENTATION_CONFIG_REVIEW.md` §1. Summary: `backend/internal/middleware/cors.go`'s allowed origin is a bare string literal with **no env-var override at all** (contrast with `config.go`'s `SERVER_PORT`, which does read from the environment for the identical "what host/port am I" concern); `frontend/src/lib/api.ts`'s backend origin is likewise hardcoded despite Docker/compose tooling being built assuming it isn't. `frontend/next.config.ts`'s `"http://localhost:8080"` fallback, by contrast, is correctly gated behind `process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??` — proving the codebase knows the correct pattern in at least one place.

### Info — Numeric limits are otherwise well-named, not truly "magic"

The backend is generally good about this: every rate-limit number in `config.go` is named, commented, and points at further tuning documentation; session lifetime is a named field; frontend pagination sizes are named `const`s, not bare inline literals (`ChatWindow.tsx`'s `NEAR_LIMIT_THRESHOLD = 1800` against `MAX_MESSAGE_LENGTH = 2000` is a good example). No unnamed magic-number business-rule violations found beyond the localhost/CORS items above and the duplicated-constant items in §2.

---

## 5. TypeScript Type Safety

**`as any`: zero occurrences. `@ts-ignore`/`@ts-expect-error`: zero occurrences.** Exactly one non-null assertion (`!`) found in the whole frontend (`UserAvatar.tsx`), and it's guarded by a boolean derived one line above — safe by construction, TypeScript just can't narrow through it. Given the near-total absence of `any`/`ts-ignore`/defensive `!`, syntax-level type discipline is good.

### DX-003 — Systemic unvalidated type assertions at the network-data boundary

**Severity:** Medium · **Confidence:** High

The real gap is at the *data-boundary* level, not syntax. The central `apiRequest<T>()` helper (`lib/api/client.ts`, used at 27+ call sites app-wide) does `return response.json() as Promise<T>` with **zero runtime schema validation** — no zod/io-ts/manual shape check anywhere in the repo (confirmed absent from `package.json`). If a backend response shape ever drifts from what a call site's `T` claims, TypeScript provides zero protection and the failure surfaces later as an undefined-property runtime error deep in a component. The same unchecked-cast pattern repeats on genuinely untrusted network data — parsed WebSocket frames in `WebSocketProvider.tsx` (7 branches, each `data.payload as XPayload` with no shape check) — and at a couple of other call sites (`groups.ts`, `profiles.ts`'s generic `readJson<T>`). Not `as any`/`ts-ignore` severity, but it is precisely the "unsafe type assertions on API response shapes without runtime validation" pattern this audit was asked to check for, and it's systemic (goes through the one shared client) rather than one-off.

---

## 6. Silent Failure Patterns

### Go — ignored errors (`_ = expr`)

Only 3 occurrences in non-test backend code, two of which are legitimate best-effort cleanup after an unrelated error (documented in `03_BACKEND_REVIEW.md` §4). The third is worth a closer look: `posts/handler.go:119` — `canDelete, _ = h.service.canModerate(viewerID, p)` discards the error from a permission check, implicitly treating "error" the same as "no permission." Fails closed, not open — not catastrophic, but worth confirming this is intentional rather than an oversight.

### BE-009 — No `recover()` anywhere in the backend; unrecovered goroutine panics would crash the whole server process

**Severity:** Low-Medium · **Confidence:** High

`grep -rn "recover()"` across the entire backend returns zero matches. The backend spawns goroutines in 8 places with no panic protection, including one pair **per WebSocket connection** (`go client.WritePump()` / `go client.ReadPump()`) plus several inside `Hub` (`BroadcastStatus`, `Unregister`, etc.). This is not "recover() that silently swallows a panic" (the pattern this audit's brief named as an example) — it's arguably worse: there is **no recover at all**, so a panic inside any per-connection goroutine (e.g. `ReadPump` processing a malformed/malicious inbound WS frame) is unrecovered and crashes the **entire server process**, taking down every other user's connection, not just the one that triggered it. No incident was observed to confirm this in practice, but it's a plausible failure mode under adversarial WebSocket input, and a one-line `defer recover()` at the top of each connection goroutine would contain the blast radius to the single connection. **Fix:** add `defer func() { if r := recover(); r != nil { log.Printf(...) } }()` at the top of `ReadPump`/`WritePump` and the hub's spawned goroutines.

### Frontend — `catch {}` blocks: mostly correct, two worth noting

29 `catch {...}` blocks found; read every one. The large majority either legitimately handle unavailable `localStorage` (5 sites, all comment-explained) or correctly surface a user-facing error (`throw new ApiError(...)` or a rendered error state) — the *opposite* of silent failure. Two exceptions:
- `useUniversalSearch.ts` has 3 genuinely empty `catch` bodies with no explanatory comment, unlike the consistently-commented pattern used for the same "storage unavailable" scenario elsewhere in the codebase. Low/Info — should get the same one-line comment for reader clarity.
- `NotificationToast.tsx` — `if (!notification.isRead) void markAsRead(notification.id).catch(() => {})` is a genuinely empty `.catch(() => {})`, no logging, no user feedback. Low severity (best-effort "mark as read," not user-blocking), but it's the one clean example of the exact pattern this audit's brief asked to search for.

### Info — `console.error` as the only signal on background-sync failures

15 total occurrences; the largest cluster is `WebSocketProvider.tsx` (7) and `useChat.ts` (3, e.g. a failed initial chat-history load logs to console with no accompanying UI state update). These are all real-time/background-sync paths (WS reconnect, chat history prefetch) where *some* silent-retry is reasonable — but a *persistent* failure (e.g., WS never reconnects) currently has no user-visible signal at all beyond the feature quietly not working. Cross-referenced with `WS-001` in `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`, which covers the specific reconnect-resync gap this silent logging masks.

---

## 7. TODO/FIXME/HACK Classification

**Zero `TODO`/`FIXME`/`HACK`/`XXX` comments exist anywhere in `backend/` or `frontend/src/` source code** — unusually clean for a codebase this size; the team appears to resolve these before merging rather than leaving them in code.

Root `TODO.md` (not source comments, but the closest thing to a tracked TODO list in the repo) has two unresolved items that read as real, current functional gaps, not obsolete cruft:
- *"privet post is not work there is not selct people so i can add them"* — root-caused precisely as `FE-001` in `02_FRONTEND_REVIEW.md`.
- *"remove saction info from the stings"* (likely "session" info from settings) — an explicit, still-open cleanup item; no corresponding code change found, flagged here as an acknowledged-but-unaddressed request rather than investigated further (out of this audit's technical scope to guess at intended scope).

---

## 8. Test Coverage Inventory

### Backend — 158 tests across 20 files in 17 feature directories (see `08_TESTING_RUNTIME_REVIEW.md` §2 for the full per-directory breakdown)

`search/` is notably thin: only **one** test, covering private-groups-hidden-from-non-members — thin relative to the 4 search domains (users/groups/posts/events) the package actually implements, and relative to every other feature directory (which average 7-9 tests each). No dedicated test directory exists for `internal/websocket` in isolation (only exercised indirectly through `chat` tests), `internal/router`, `internal/requestctx`, `internal/seed`, or `pkg/session`/`pkg/response` — reasonable for glue/wiring code.

### `TEST-001` — Frontend has zero automated test coverage of any kind

**Severity:** Medium · **Confidence:** High

No `jest.config.*`/`vitest.config.*`/`playwright.config.*` anywhere under `frontend/`; no `jest`/`vitest`/`@testing-library/*`/`playwright` in `package.json` devDependencies; zero `.test.ts(x)`/`.spec.ts(x)` files anywhere in `frontend/src`. The one test-shaped script, `"test:smoke": "bash tests/run-smoke.sh"`, points at a file that does not exist in the repository (`frontend/tests/` doesn't exist at all) — confirmed by direct execution during this audit (`08_TESTING_RUNTIME_REVIEW.md`). This means every frontend-only defect surfaced across this entire audit (`FE-001`, `FE-003`, `WS-001`/`WS-003`/`WS-006`, the 3D findings) is, by construction, currently uncatchable by any automated check — only manual QA or user reports (as with `FE-001`, which the project's own developer flagged manually in `TODO.md`).

---

## Summary of Severities

- **High**: 0 in this file (the High-severity config finding is filed once, as `DOC-001`, in `10_DOCUMENTATION_CONFIG_REVIEW.md`)
- **Medium**: `DX-001`, `DX-002`, `DX-003`, `TEST-001`
- **Low**: `DX-004`, `DX-005`, `BE-009` (no-recover), file-size/structure smells (`BE-004`/`groups/handler.go`, `seed.Run`), console-only WS/chat error handling, misplaced `notes.txt`, broken `test:smoke` script
- **Info**: dead symbols (§1), minor naming inconsistency, uncommented-but-benign empty catches, single non-null assertion, `search/` thin coverage

No `TODO`/`FIXME`/`HACK` comments exist in source to classify. No orphaned CSS modules or dead frontend files found. Frontend has zero automated test coverage; backend has 158 tests across 17 well-mapped feature directories, with `search/` notably thin.
