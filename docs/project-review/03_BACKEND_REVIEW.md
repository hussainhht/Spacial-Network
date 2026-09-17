# 03 — Backend Review

> Scope: `backend/internal/**`, `backend/pkg/**`, `backend/cmd/**`. Architecture, HTTP correctness, error handling, concurrency. Authorization/privacy depth is in `05_AUTH_SECURITY_PRIVACY_REVIEW.md`; database/migrations depth is in `04_DATABASE_MIGRATIONS_REVIEW.md`; WebSocket/chat business logic is in `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. All findings below were independently traced call-chain-to-call-chain (handler → service → repository), not inferred from naming.

---

## 1. Summary

The backend is **genuinely well-architected**. Clean Architecture layering (Handler → Service → Repository) is respected almost without exception — no raw SQL was found inside any `handler.go` or `service.go`; authorization checks consistently live in the service layer; multi-statement writes that need atomicity (group join/invite acceptance, post creation with media/viewers, viewer-list replacement) are correctly wrapped in `database/sql` transactions with `defer tx.Rollback()`. `go build`, `go vet`, and a full `go test -race ./...` all pass clean (see `08_TESTING_RUNTIME_REVIEW.md`). `internal/websocket` and `internal/ratelimit` are both carefully mutex/`sync.Map`-guarded, with no data races, deadlocks, or goroutine leaks found.

The issues found are real but consistently **Medium-and-below** — protocol/consistency gaps and a few copy-paste error-handling mistakes, not architectural failures.

---

## 2. Architecture Findings

### BE-004 — `groups` package has absorbed disproportionate responsibility; several files exceed maintainable size

**Severity:** Low · **Confidence:** High

**Evidence:**
```
1156 internal/groups/handler.go
 654 internal/posts/handler.go
 615 internal/groups/repository.go
 561 internal/followers/repository.go
 506 internal/followers/handler.go
```
`groups` is additionally split across 12 files (`handler.go`, `event_handler.go`, `model.go`, `event_model.go`, `repository.go`, `transactions.go`, `errors.go`, `event_errors.go`, `validation.go`, `event_validation.go`, `ws.go`, `event_ws.go`) covering group CRUD, membership, join requests, invitations, events, and realtime invite search — five sub-features in one package.

**Why it matters:** Raises navigation/review/merge-conflict cost; a symptom of feature creep into one package, not yet a functional defect. Confirmed by git churn data (see `09_CODE_QUALITY_TECH_DEBT.md`) showing `groups/*` among the most frequently modified files in the repo's history.

**Recommended fix:** Split into sub-domains (e.g. `groups/membership`, `groups/events`) or at minimum split `handler.go` by concern, mirroring the `event_*.go` split already done for events.

---

### BE-005 — Duplicated method-check boilerplate; ~11 of 19 in-handler `r.Method !=` checks are dead code

**Severity:** Low · **Confidence:** High

**Evidence:** 19 in-handler `if r.Method != http.MethodX` checks across `search`, `auth`, `groups`, `posts`, `groups/event_handler.go`, `chat`, `users`. Cross-referenced against `internal/router/router.go`: most of these routes are *also* registered with an explicit HTTP verb in the method-aware `http.ServeMux` pattern (Go 1.22+, e.g. `router.go:143` `"POST /posts/{id}/comments"`), meaning the mux already rejects the wrong method with its own `405` before the handler body runs. Concretely dead: all 4 checks in `chat/handler.go`, `search/handler.go:25`, `posts/handler.go:221`, 2 of 5 in `users/handler.go`, all 5 in `groups/handler.go` + `event_handler.go`. Conversely, checks on routes registered **without** a verb in the mux pattern (`/login`, `/register`, `/logout`, `/users/me`, `/profiles/{username}`, `/users/me/privacy`) are load-bearing.

**Why it matters:** Two unmarked conventions coexist in the same router ("method enforced by mux" vs. "method enforced by handler"); a reader can't tell which applies without cross-referencing `router.go`. Each handler also independently reimplements its own 405 response, in one of three different JSON shapes (see BE-002).

**Recommended fix:** Register every route with an explicit method (eliminating in-handler checks entirely), or centralize the check as middleware — pick one convention.

---

### BE-006 — `pkg/response.JsonResponse` is a maintained helper with zero adopters

**Severity:** Low · **Confidence:** High

**Evidence:** `backend/pkg/response/json.go` implements `JsonResponse(w, data)`, which correctly sets `Content-Type: application/json` and checks the `Encode` error. `grep -rln "pkg/response" internal --include="*.go"` → **zero matches**. This helper already solves both BE-001 and BE-003 below, but nothing imports it.

**Why it matters:** Suggests an abandoned refactor, or handlers pre-dating the helper that were never migrated. It is dead-but-correct code sitting next to three live, duplicated bugs it would have prevented.

**Recommended fix:** Adopt it uniformly (fixing BE-001/BE-002/BE-003 in one pass) or delete it if the per-package `Response` struct pattern is meant to be permanent.

---

## 3. HTTP Correctness Findings

### BE-001 — `posts`, `likes`, `share`, `comments` handlers never set `Content-Type`; responses are served as `text/plain`

**Severity:** Medium · **Confidence:** High (empirically reproduced)

**Evidence:** `grep -c 'Header().Set("Content-Type"'` across handler files: `posts` (12 handlers, 0 sets), `likes` (4, 0), `share` (1, 0), `comments` (5, 0) — vs. `followers` (10/9), `groups` (19/19), `users` (5/5), `notifications` (4/4), `chat` (4/4), `search` (1/1), all correct. Reproduced empirically with a real `httptest.NewServer` (not `ResponseRecorder`, which doesn't content-sniff): a handler writing `` `{"message":"Post updated"}` `` with no explicit `Content-Type` is served by Go's real `net/http` as `Content-Type: text/plain; charset=utf-8` (Go's `http.DetectContentType` sniff has no dedicated JSON signature).

**Why it matters:** A real, externally observable protocol inconsistency across roughly a third of the API surface, covering the highest-traffic endpoints (feed, like button, comment thread). Browser `fetch().json()` happens to work regardless of the header, which is almost certainly why this has gone unnoticed — but any strict client, gateway, or content-negotiation logic would misbehave.

**Recommended fix:** Set `Content-Type: application/json` at the top of every handler in these four packages, ideally via the existing `pkg/response.JsonResponse` helper (BE-006).

---

### SEC-003 — `PUT/PATCH/DELETE /posts/{id}` and `DELETE /comments/{id}` leak resource existence via 403-vs-404 for content the caller cannot even view

**Severity:** Low · **Confidence:** High

**Evidence:** `posts/service.go:120-127` (`UpdatePost`) and `:260-275` (`DeletePost`) fetch the post **unconditionally** (`s.repo.GetPostByID`, no visibility check) and branch only on `existing.User_ID != userID` → `ErrForbidden` (→ 403 via `posts/handler.go:636-654`). `comments/service.go:124-141` (`DeleteComment`) does the identical thing. By contrast, `GetPostByIDHandler` (read path, `posts/handler.go:397-433`) correctly routes through `canAccessPost` and collapses "doesn't exist" and "exists but you can't see it" into a single `404`.

**Why it matters:** A caller with zero relationship to a private/custom/group post they cannot view at all gets `403 "Not allowed to modify this post"` (ID exists) vs `404 "Post not found"` (ID doesn't exist) when attempting `PUT`/`DELETE` — a status-code existence oracle for content otherwise fully hidden from them. Low severity: reveals existence only, not content.

**Recommended fix:** In `UpdatePost`/`DeletePost`/`DeleteComment`, check visibility (`canAccessPost`) before/alongside ownership, and return the "not found" error when the caller can't view the resource at all — reserving 403 for "you can see it, but don't own/moderate it."

**Related:** `SEC-004` (same pattern, more consequential, on group mutation endpoints).

---

### BE-002 — Three incompatible error-response JSON envelopes coexist across the API

**Severity:** Low · **Confidence:** High

**Evidence:**
- Shape 1, `{"error": "...", "message": "..."}`: `posts`, `likes`, `share`, `comments`, `notifications`, `auth`.
- Shape 2, `{"success": false, "message": "..."}`: every response type in `groups`, `users`, `followers`.
- Shape 3, untyped `map[string]string{"error": "..."}`: every handler in `chat`, `search`.

**Why it matters:** No API consumer can use one generic error-parsing path across the whole surface — it must know per-endpoint whether to read `.error`, `.message`+`.success`, or a bare map. This is exactly what the unused `pkg/response` (BE-006) appears built to prevent.

**Recommended fix:** Standardize on one error envelope, routed through a shared helper.

---

## 4. Error Handling Findings

### BE-003 — Raw filesystem/OS error text is returned to the client on genuine `500` upload failures (6 locations, 5 packages)

**Severity:** Medium · **Confidence:** High

**Evidence:** Identical copy-pasted pattern in `posts/handler.go:368-378`, `comments/handler.go:126-137`, `groups/handler.go:204-218` and `:317-329`, `users/handler.go:314-328`, `auth/handler.go:282-296`. Each: on an upload failure that is *not* `ErrInvalidFileType`/`ErrFileTooLarge` (i.e. a genuine OS-level failure — disk full, permission denied), status is correctly set to `500`, but the body still serializes `err.Error()` — the raw Go `os`/`io` error, potentially including server filesystem paths. `internal/groups/event_handler.go`'s own upload path (`CreateEventHandler`) gets this right: fixed `"Unable to store event image"` message on the `500` branch, proving the correct pattern already exists in the same codebase, just wasn't applied consistently to the other 6 sites.

**Why it matters:** Real information-disclosure class bug (server filesystem paths, disk/permission errors), though exploitability is limited since it only triggers on genuine OS-level failure, not attacker-controlled input (filenames are UUIDs; content-type is separately validated — see `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §11.1).

**Recommended fix:** In all 6 locations, use a fixed message on the `500` branch (matching `event_handler.go`'s existing pattern); reserve `err.Error()` for the `400` branch, where the error is guaranteed to be a safe, static, user-facing validation message.

---

### BE-007 — `AuthService.CleanupSessions()` runs exactly once, at process startup, with no periodic sweep

**Severity:** Medium · **Confidence:** High

**Evidence:** `internal/router/router.go:23-25` is the *only* call site in the codebase. It fires once during `NewRouter` (i.e., once per process start). Contrast with `internal/ratelimit/limiter.go:192-234`, which implements a correct, periodic `cleanupLoop()` on a `time.Ticker` (default 2 min), started in `NewLimiter`, in the same codebase, for the identical class of problem (evicting stale state).

**Why it matters:** For a long-running server process, expired/revoked sessions accumulate in the `sessions` table indefinitely between restarts — unbounded table growth over the life of a long-running instance. Doesn't break session-validation correctness (expiry is presumably re-checked at query time regardless — confirmed in `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §2.3), but is a clear inconsistency with the cleanup pattern the same codebase already built for the rate limiter.

**Recommended fix:** Start a periodic goroutine (mirroring `ratelimit.Limiter.cleanupLoop`) that calls `AuthService.CleanupSessions()` on an interval, stoppable on shutdown.

---

### BE-008 — `json.NewEncoder(w).Encode(...)` errors are discarded at all ~370 call sites

**Severity:** Low · **Confidence:** High

**Evidence:** `grep -rn "json.NewEncoder(w).Encode" internal --include="*.go" | wc -l` → 370; `grep -rn "if err := json.NewEncoder(w).Encode"` → 0. Not one site checks the error. The unused `pkg/response.JsonResponse` (BE-006) does check it.

**Why it matters:** Low practical impact (failure after `WriteHeader` has flushed is rare, and there's little a handler could do about it anyway), but a real, consistent, codebase-wide gap matching the audit brief's "silent failure" pattern search.

**Recommended fix:** Low priority; address via a shared `writeJSON` helper if/when BE-002/BE-006 are fixed, not via 370 individual edits.

---

### Positive findings (Info, no action required)

- **Two explicit `_ = ...` ignored-error sites** (`posts/handler.go:393`, `groups/event_handler.go:67`) are both deliberate best-effort cleanup of orphaned uploaded files on an already-failing request path — correct, not a defect.
- **Multi-step DB writes are correctly transactional everywhere reviewed**: `posts/repository.go` (`CreatePost`, `SetAllowedViewerIDs`), `followers/repository.go` (`UnfollowUser`), `groups/repository.go` (`InsertGroup`), `groups/transactions.go` (`RespondToJoinRequest`/`RespondToInvitation` use compare-and-swap `WHERE status = 'pending'` semantics, correctly guarding against a concurrent double-accept race). No partial-update risk found.
- **Duplicate-operation (idempotency) handling is correct and consistent**: double-like is `INSERT OR IGNORE` + no-op 200; double-follow maps a `UNIQUE` constraint violation to `409`; double-unlike/unfollow-nothing correctly return `404`.

---

## 5. Concurrency Findings

### Positive findings (Info) — no races, deadlocks, or leaks found

- **`internal/websocket`** (`hub.go`, `client.go`, `handler.go`): `Hub.clients` is guarded by a single `sync.RWMutex` with consistent access everywhere; `Client.Send` is non-blocking (a full/stalled client is dropped and unregistered rather than blocking the sender/hub); `Client.Close()` is `sync.Once`-guarded against concurrent close from `ReadPump`/`WritePump`/`Hub.Unregister`; client registration happens before `WritePump`/`ReadPump` start, with no dependency/deadlock risk since `Send` just enqueues onto a buffered (256) channel. `go test -race ./internal/websocket/...` passes, including a dedicated `TestHubConcurrentSend` (100 goroutines × `Broadcast`/`SendToUser` over 50 clients).
- **`internal/ratelimit`**: `sync.Map` used specifically to avoid cross-user/cross-endpoint lock contention; `LoadOrStore` avoids a check-then-act race on first-use bucket creation; each `Bucket` has its own private mutex; the periodic `cleanupLoop` is `Close()`-able via `sync.Once`.

### BE-009 — Neither `ratelimit.Limiter.Close()` nor a hub/WS shutdown is called from `cmd/server`

**Severity:** Info · **Confidence:** High

**Evidence:** `grep -rn "RateLimiter.Close\|\.Close()" cmd/server/*.go` finds only `db.Close()`. `waitForShutdown` calls `server.Shutdown(ctx)` (10s timeout) then the process exits.

**Why it matters:** Harmless within a running process's lifetime (OS process exit reclaims everything regardless, and Go's `http.Server.Shutdown` doesn't track hijacked WebSocket connections as in-flight anyway). The only user-visible effect: connected WebSocket clients see an abrupt drop (no close frame) on a graceful restart/deploy, rather than a clean disconnect.

**Recommended fix:** Optional polish — call `rateLimiter.Close()` and send a close frame to connected hub clients during `waitForShutdown`. Not required for correctness.

---

## 6. Cross-Reference

- Authorization-layer placement (are checks in the right layer?) is covered in depth in `05_AUTH_SECURITY_PRIVACY_REVIEW.md` — this file confirms structurally that checks live in the service layer, not handler/repository, consistent with that review's authorization tracing.
- WebSocket **business-logic** correctness (chat/notification races, reconnect gaps) is in `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`; this file covers only the transport-level concurrency primitives (`Hub`/`Client`), which are sound.
- Database/query-quality findings (N+1, missing indexes, transaction review from the query side) are in `04_DATABASE_MIGRATIONS_REVIEW.md`.
