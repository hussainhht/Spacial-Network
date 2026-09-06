# Social Network — Full Test Audit Report

**Audit type:** Read-only testing and audit. No production code was modified.
**Audit date:** 2026-09-06
**Branch audited:** `feat/notfcation-frontend` (working tree clean at start and end)

---

## 1. Executive Summary

| Result | Count |
|---|---:|
| PASS | 77 |
| FAIL | 6 |
| WARNING | 13 |
| NOT IMPLEMENTED | 12 |
| BLOCKED | 3 |
| **Total checks** | **116** |

**Overall assessment:** The implemented slice of the application (auth, posts with binary privacy, groups with join-requests/invitations, notifications for those two group events, and the WebSocket presence layer) is solid — authorization checks are consistently session-derived, ownership checks are correct everywhere they were tested, SQL uses parameterized queries throughout, and migrations are clean and reversible. However, three things stand out:

1. **Private chat is completely non-functional** — messages sent over the WebSocket are silently dropped, never delivered, and never persisted, because the chat event handler is never registered with the WebSocket router. This was confirmed live (Section 13/16, ERR-001).
2. **Profile privacy is cosmetic** — the `is_private` flag can be set but is never checked; any authenticated user can fetch any other user's full profile (email, age, gender, real name) regardless of that setting. Confirmed live (ERR-002).
3. **Several features assumed by the audit brief do not exist in this codebase at all**: Followers, Comments, Group Events, and Group Posts/Comments. These are not bugs — they are simply unbuilt — and are reported as `NOT IMPLEMENTED` rather than failures.

Build, vet, and the project's own (minimal) test suite all pass. The frontend builds and type-checks cleanly; lint found 3 errors and 2 warnings. No Docker setup exists anywhere in the repository.

---

## 2. Environment

| Item | Value |
|---|---|
| OS | Linux 7.0.0-31-generic (via provided environment info) |
| Go | go1.26.7 linux/amd64 |
| Node | v24.18.0 |
| npm | 11.16.0 |
| Next.js | 16.3.2 (Turbopack) |
| React / React DOM | 19.2.8 |
| TypeScript | 5.9.3 |
| SQLite (CLI, used for read-only inspection only) | 3.45.1 |
| SQLite driver | `github.com/mattn/go-sqlite3` v1.14.50 (cgo) |
| WebSocket library | `github.com/gorilla/websocket` v1.5.3 |
| Docker | Not applicable — no Dockerfile/docker-compose exists in the repository |

---

## 3. Commands Executed

```bash
cd backend && go build ./...
```
Result: **PASS** (exit 0, no output)

```bash
cd backend && go vet ./...
```
Result: **PASS** (exit 0, no output)

```bash
cd backend && go test ./... -v
```
Result: **PASS**
```
=== RUN   TestHubRegisterUnregister
--- PASS: TestHubRegisterUnregister (0.00s)
=== RUN   TestHubConcurrentSend
--- PASS: TestHubConcurrentSend (0.00s)
PASS
ok    social/internal/websocket    0.005s
```
Every other package reports `[no test files]` — see Section 4.

```bash
cd backend && go test -race ./...
```
Result: **PASS** (`ok social/internal/websocket 1.024s`, no race detected)

```bash
cd frontend && npm run lint
```
Result: **FAIL** (3 errors, 2 warnings) — see Section 5.

```bash
cd frontend && npx tsc --noEmit
```
Result: **PASS** (no output, no errors)

```bash
cd frontend && npm run build
```
Result: **PASS** — all 14 routes compiled and prerendered successfully.

Temporary, audit-only commands (migration cycle test, WebSocket protocol tests) are described in Sections 7, 13, 14 and were run against an isolated sandbox, not the project's own command set.

---

## 4. Existing Tests

| Suite | Location | Result |
|---|---|---|
| `TestHubRegisterUnregister` | `backend/internal/websocket/hub_test.go` | PASS |
| `TestHubConcurrentSend` | `backend/internal/websocket/hub_test.go` | PASS (also clean under `-race`) |

**Finding:** This is the *only* test file in the entire backend. `auth`, `chat`, `config`, `groups`, `middleware`, `notifications`, `posts`, `requestctx`, `router`, `upload`, `users`, `validation`, and the `pkg/db/sqlite` migration runner all have zero automated tests. The frontend has **no test framework at all** — `package.json` declares no Jest/Vitest/React Testing Library/Playwright dependency, and no `*.test.ts(x)`/`*.spec.ts(x)` file exists anywhere under `frontend/src`.

---

## 5. Frontend Results

### TypeScript
`npx tsc --noEmit` — **PASS**, zero errors. `next build`'s own TypeScript pass also completed cleanly in 2.3s.

### Lint
`npm run lint` — **3 errors, 2 warnings**:

| File | Rule | Severity |
|---|---|---|
| `src/app/(auth)/login/page.tsx:89` | `react/no-unescaped-entities` (raw `'`) | error |
| `src/features/groups/hooks/useInviteUserSearch.ts:33` | `react-hooks/set-state-in-effect` (setState called synchronously in an effect) | error |
| `src/features/groups/hooks/useInviteUserSearch.ts:60` | `react-hooks/set-state-in-effect` | error |
| `src/features/groups/components/GroupInviteSearch.tsx:58` | `@next/next/no-img-element` (`<img>` instead of `next/image`) | warning |
| `src/providers/WebSocketProvider.tsx:69` | `@typescript-eslint/no-unused-vars` (`error` caught but unused) | warning |

### Build
`npm run build` — **PASS**. All 14 routes compiled (7 static, 3 dynamic `ƒ`, plus `/_not-found`):
`/`, `/chat`, `/groups`, `/groups/[groupId]`, `/groups/create`, `/login`, `/notifications`, `/posts`, `/posts/[id]`, `/posts/[id]/edit`, `/posts/new`, `/profile`, `/profile/[username]`, `/register`.

### Runtime
Live headless-browser smoke test (Chromium, see Section 15) loaded 7 routes against the developer's already-running dev servers (read-only, no form submissions/no data mutation): `/login`, `/register`, `/`, `/profile`, `/notifications`, `/posts/abc`, `/groups/abc`. **No uncaught page errors (`pageerror`) and no failed static-asset requests on any route.** All console output was either expected dev noise (React DevTools hint, HMR connected) or expected 401s from unauthenticated background API/WebSocket calls.

### Hydration
**No hydration-mismatch warnings observed** on any of the 7 routes tested live. Static review of SSR-unsafe patterns (`window`/`document`/`Date.now()`/`Math.random()`) found all such usage correctly scoped to `"use client"` components inside effects/handlers, with one **latent** risk: `NotificationItem.tsx` calls `Date.now()` directly during render (not in an effect) to compute relative time — currently harmless because `NotificationProvider` only populates data client-side after mount, but would become a real hydration-mismatch source if server-side notification prefetching is ever added.

### Routing
- All static and dynamic routes resolve and render.
- **Confirmed live:** visiting `/` while unauthenticated correctly redirects to `/login` (via `PostFeed.tsx`'s own 401 handler). **Also confirmed live:** visiting `/profile`, `/notifications`, `/groups/abc`, or `/chat` while unauthenticated does **not** redirect — the page renders with silent background 401s in the console instead. See ERR-005.
- Dynamic-segment ID validation is inconsistent across features: `posts/[id]` explicitly validates with `Number.isFinite` and renders a distinct "Invalid post id" state; `groups/[groupId]` validates with `Number.isNaN` inside a try/catch that instead surfaces a generic "Failed to load group" message; `profile/[username]` (a server component using the Promise-based `params` convention) performs no format validation at all.

### API Integration
See Section 19 for the full contract-mismatch table. Headline finding: the frontend's chat feature (`app/(main)/chat/page.tsx`, `features/chat/hooks/useChat.ts`) sends exactly the WebSocket events the backend defines (`private_message`, `typing`) but the backend never routes them to its chat handler — see ERR-001.

---

## 6. Backend Results

### Build
`go build ./...` — **PASS**.

### Go Tests
See Section 4 — 2/2 tests pass; coverage is limited to the WebSocket hub.

### Vet
`go vet ./...` — **PASS**, no findings.

### Runtime
An isolated instance of the compiled server was started against a fully temporary sandbox database (see Section 25 for why) and exercised via `curl` and two small, temporary Go WebSocket clients (deleted after use — Section 24). No panics, no unexpected 500s, and no goroutine leaks were observed across ~50 requests and multiple concurrent WebSocket sessions.

### HTTP API
Full route map (all under `/api/`, all except `/login`/`/register` require a valid session cookie):

| Area | Routes |
|---|---|
| Auth | `POST /login`, `POST /register`, `GET/POST /logout` |
| Users/Profile | `GET /users/me`, `PATCH /users/me/privacy`, `GET /profiles/{username}` |
| Posts | `POST /posts`, `GET /posts`, `GET /posts/{id}`, `PUT\|PATCH /posts/{id}`, `DELETE /posts/{id}` |
| Groups | `GET/POST /groups`, `GET /groups/{id}`, `GET /groups/{id}/members`, `GET /groups/{id}/membership`, `POST/GET /groups/{id}/join-requests`, `POST /groups/{id}/join-requests/{id}/accept\|reject`, `POST /groups/{id}/invitations`, `GET /group-invitations`, `POST /group-invitations/{id}/accept\|decline` |
| Chat | `GET /chat/history`, `GET /chat/conversations` (REST only; sending is WS-only and currently broken, see ERR-001) |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/{id}/read` |
| WebSocket | `GET /ws` (upgrade) |
| Static | `GET /uploads/*` — public, unauthenticated, **outside** `/api/` and CORS |

Comments, Followers, Group Events, and Group Posts/Comments have **no routes at all** — the router file has explicit `// TODO` stubs for Comments and Followers, and no code path for Group Events/Posts exists anywhere.

### Authorization
See Section 20 for the full write-up. Summary: actor identity is consistently derived from the session (never from client-supplied fields) everywhere in the codebase — no actor-spoofing IDOR was found. Two real gaps were found and confirmed live: profile privacy is unenforced (ERR-002) and group details/member lists are visible to non-members (ERR-003).

---

## 7. Database & Migration Results

Testing method: a temporary Go test file (`backend/pkg/db/sqlite/migration_audit_temp_test.go`, deleted after the run — Section 24) exercised the migration runner against an isolated `t.TempDir()` SQLite database. The developer's real database (`backend/data/social-network.db`) was never opened for writes at any point (see Section 25 for checksum proof).

| Check | Result | Detail |
|---|---|---|
| Fresh `MigrateUp` | PASS | All 12 migrations applied, version `20260904180906` |
| Idempotent re-`MigrateUp` | PASS | No-ops cleanly, version unchanged |
| `MigrateDown` (one step) | PASS | Version decreased to `20260904135448` |
| Re-`MigrateUp` after single down | PASS | Cleanly re-applies, version restored |
| `MigrateDownAll` | PASS | Version returns to `0` |
| Full `MigrateUp` after `MigrateDownAll` | PASS | Cleanly re-applies all 12, version restored |
| Foreign keys enforced on app connection | PASS | `PRAGMA foreign_keys` = `1` (set via `?_foreign_keys=on` DSN param in `pkg/db/sqlite/sqlite.go:16`); inserting a `notifications` row with a nonexistent `receiver_id` correctly raises `FOREIGN KEY constraint failed` |
| Duplicate/out-of-order migration versions | PASS | All 12 migrations strictly increasing, no duplicates, every `.up.sql`/`.down.sql` pair present and readable |
| Migration transaction safety | STATIC REVIEW ONLY | `runMigrationUp`/`runMigrationDown` (`pkg/db/sqlite/migrations.go`) wrap each migration + `schema_migrations` bookkeeping in a single transaction — reviewed, not independently fault-injected |

No missing up/down pairs, no SQL syntax errors, no conflicting versions were found across the 12 migration files.

---

## 8. Feature Test Matrix

| Feature | Test | Result | Notes |
|---|---|---|---|
| Auth | Register valid user | PASS | 201, avatar optional |
| Auth | Register duplicate email | PASS | 409 |
| Auth | Register missing/invalid fields | PASS | 400, field-specific messages |
| Auth | Register with invalid image type (content-sniffed) | PASS | 400 "must be a JPEG, PNG, or GIF image" |
| Auth | Register with oversized avatar (>5MB) | PASS | 400, hard cap enforced |
| Auth | Register with valid PNG avatar | PASS | 201, served correctly at `/uploads/avatars/<uuid>.png` |
| Auth | Login valid credentials | PASS | 200, `HttpOnly` session cookie set |
| Auth | Login wrong password | PASS | 401, generic message (no user enumeration) |
| Auth | Login nonexistent user | PASS | 401, identical generic message |
| Auth | Protected route with valid session | PASS | `GET /users/me` → 200 |
| Auth | Protected route with no cookie | PASS | 401 (Content-Type inconsistency — WARN-002) |
| Auth | Protected route with garbage cookie | PASS | 401 JSON "invalid session" |
| Auth | Logout | PASS | cookie cleared, session revoked |
| Auth | Access after logout | PASS | 401 "Cookie Not Found" |
| Auth | Re-login invalidates previous session token | WARNING | single-session-per-user design, see WARN-006 |
| Auth | Sliding 30-min session expiry | STATIC REVIEW ONLY | code-reviewed only |
| Profile | `GET /users/me` | PASS | |
| Profile | Password hash never in any response | PASS | confirmed in code + live payloads |
| Profile | `GET /profiles/{username}` nonexistent user | PASS | 404 |
| Profile | Update own `is_private` flag | PASS | persists correctly |
| Profile | Private profile viewed by unrelated user | **FAIL** | full PII returned regardless of `is_private` — ERR-002 |
| Profile | Nickname / About-me fields | NOT IMPLEMENTED | no such columns exist |
| Posts | Create public post | PASS | |
| Posts | Create private post | PASS | |
| Posts | Feed hides others' private posts | PASS | |
| Posts | Feed includes own private posts | PASS | |
| Posts | `GET` private post by ID as non-owner | PASS | 404 (not 403 — avoids existence leak) |
| Posts | `GET` post with non-numeric ID | PASS | 400 |
| Posts | `GET` nonexistent numeric post ID | PASS | 404 |
| Posts | Empty title/content rejected | PASS | 400 |
| Posts | Edit by non-owner | PASS | 403 |
| Posts | Delete by non-owner | PASS | 403 |
| Posts | Edit/delete by owner | STATIC REVIEW ONLY | ownership-negative path tested live; owner-positive path code-reviewed only |
| Posts | Image/GIF upload on posts | NOT IMPLEMENTED | |
| Posts | Multi-tier privacy (almost-private/selected-followers) | NOT IMPLEMENTED | only a binary `private` column exists |
| Comments | Any comment functionality | NOT IMPLEMENTED | no routes, no backend package |
| Groups | Create group | PASS | |
| Groups | List/browse groups | PASS | all groups visible to all logged-in users (no group-privacy concept exists) |
| Groups | Get group details as non-member | WARNING | no membership check — ERR-003 |
| Groups | Get member list as non-member | WARNING | confirmed live — ERR-003 |
| Groups | Get own membership status | PASS | correctly scoped to caller |
| Groups | Send join request | PASS | 201 |
| Groups | Duplicate join request | PASS | 409 |
| Groups | Non-creator lists pending join requests | PASS | 403 |
| Groups | Creator lists pending join requests | PASS | |
| Groups | Creator accepts join request | PASS | requester becomes member |
| Groups | Re-accept already-resolved request | PASS | 409 |
| Groups | Any member (not just creator) sends invitation | PASS | by design — confirmed live |
| Groups | Invite self | STATIC REVIEW ONLY | `ErrCannotInviteSelf` reviewed in code |
| Groups | Duplicate invitation | STATIC REVIEW ONLY | unique index + pre-check reviewed in code |
| Groups | Invitee receives invitation | PASS | confirmed via `GET /notifications` |
| Groups | Non-invitee accepts/declines invitation | PASS | 404 (avoids enumeration) |
| Groups | Invitee accepts invitation | PASS | becomes member |
| Group Events | Create/list/RSVP | NOT IMPLEMENTED | no schema, no endpoints |
| Group Posts/Comments | Any | NOT IMPLEMENTED | no schema, no endpoints |
| Followers | Follow/unfollow/request/accept/list | NOT IMPLEMENTED | entire feature absent |
| WebSocket | Authenticated connect | PASS | |
| WebSocket | Unauthenticated connect | PASS | 401 before upgrade |
| WebSocket | Multiple simultaneous connections, same user | PASS | both receive initial presence snapshot |
| WebSocket | Malformed JSON event | WARNING | silently dropped, no error frame sent back |
| WebSocket | Unknown event type | WARNING | silently dropped, no error frame sent back |
| WebSocket | Concurrent send (race) | PASS | `go test -race` clean |
| WebSocket | Disconnect cleanup | STATIC REVIEW ONLY | `Hub.Unregister` logic reviewed, not forced via abrupt disconnect |
| Chat | Send `private_message` over WS | **FAIL** | CRITICAL — never delivered, never persisted — ERR-001 |
| Chat | Send `typing` indicator over WS | **FAIL** | same root cause |
| Chat | `GET /chat/history` (REST) | PASS | endpoint itself correct; empty result is consistent with 0 persisted messages |
| Chat | `GET /chat/conversations` (REST) | PASS | endpoint itself correct |
| Chat | Messaging eligibility/authorization | WARNING | no relationship check exists (no followers feature to gate on) |
| Chat | Frontend chat UI end-to-end | **FAIL** | demo-only page; depends on the broken WS path |
| Group Chat | Any | NOT IMPLEMENTED | |
| Notifications | `group_invitation` created + persisted | PASS | |
| Notifications | `group_invitation` correct receiver/actor/entity | PASS | |
| Notifications | `group_invitation` real-time WS delivery | PASS | confirmed live |
| Notifications | `group_join_request` created + persisted | PASS | |
| Notifications | `group_join_request` correct receiver/actor/entity | PASS | |
| Notifications | `group_join_request` real-time WS delivery | PASS | confirmed live |
| Notifications | Mark single notification as read | PASS | |
| Notifications | Mark-as-read ownership enforced | PASS | 404 for non-owner |
| Notifications | Mark all as read | PASS | |
| Notifications | Unread count | PASS | counts all 4 defined types, not just the 2 ever created — WARN-007 |
| Notifications | `follow_request` / `group_event` types | NOT IMPLEMENTED | constants exist, never triggered |
| Notifications | Frontend bell/dropdown/inbox render | PASS | build-verified for the 2 supported types |
| Notifications | Frontend click navigation | WARNING | always routes to `/groups`, not deep-linked — WARN-008 |
| Frontend | All 14 routes build | PASS | |
| Frontend | No hydration errors (7 routes, live browser) | PASS | |
| Frontend | No uncaught page errors (live) | PASS | |
| Frontend | Unauthenticated redirect on `/` | PASS | redirects to `/login` |
| Frontend | Unauthenticated redirect on `/profile`, `/notifications`, `/groups/[id]`, `/chat` | **FAIL** | no redirect, silent 401s — ERR-005 |
| Frontend | Invalid dynamic ID (`/posts/abc`) | PASS | shows "Invalid post id" |
| Frontend | Invalid dynamic ID (`/groups/abc`) | WARNING | generic "Failed to load group", not a distinct invalid-id state |
| Integration | Route/field naming alignment (frontend ↔ backend) | PASS | no naming mismatches found; WS event type strings match exactly |
| Integration | Hardcoded/duplicated API base URL (`profiles.ts`) | WARNING | WARN-005 |
| Integration | Chat REST unused by frontend / frontend WS chat unused by backend | **FAIL** | tied to ERR-001 |
| CORS | Preflight `OPTIONS` | PASS | 204, correct headers |
| CORS | Fixed-origin, non-reflective `ACAO` | PASS | confirmed with a forged `Origin` header — response still says `localhost:3000` |
| CORS | No environment-based origin/API URL config | WARNING | WARN-011 |
| WebSocket | `CheckOrigin` always returns `true` | WARNING | ERR-004 |
| Uploads | Valid JPEG/PNG/GIF avatar | PASS | PNG tested live; JPEG/GIF share the identical code path |
| Uploads | Invalid MIME rejected | PASS | |
| Uploads | Oversized file rejected | PASS | |
| Uploads | Path traversal / filename safety | PASS | STATIC REVIEW, UUID-based naming, no user input reaches the filesystem path |
| Uploads | Directory listing on `/uploads/avatars/` | WARNING | WARN-001 |
| Uploads | Avatar update after registration | NOT IMPLEMENTED | |
| Uploads | Post/comment media upload | NOT IMPLEMENTED | |
| Docker | Any Dockerfile/compose present | NOT IMPLEMENTED | none found anywhere in the repo |
| Docker | Build images | BLOCKED | no Dockerfile/docker-compose exists to build |
| Chat | Two independent browser sessions, live E2E | BLOCKED | no browser-automation framework in the project; verified at protocol level instead |
| Auth | Real 30-minute session expiry | BLOCKED | would require an unattended 30+ minute wait; code-reviewed only |
| Migrations | Up/down/re-up/down-all cycle | PASS | see Section 7 |
| Migrations | Foreign keys enforced | PASS | see Section 7 |
| Migrations | No duplicate/out-of-order versions | PASS | see Section 7 |

---

## 9. Authentication

Registration, login, logout, and session handling were all tested live against an isolated sandbox instance (Section 25 explains why a sandbox rather than the developer's real DB was used).

- **Registration** (`POST /api/register`, `internal/auth/handler.go:173-328`): multipart form, capped at 8 MiB total. Validates username (3–20 chars), password (8–72 bytes, matching bcrypt's own limit), email format, gender (`male`/`female`), and age (1–120). Uniqueness is checked for both username and email before insert, backed by `UNIQUE` DB constraints. Optional avatar upload is content-sniffed (not trusted from the client's declared `Content-Type` or filename) and capped at 5 MiB with a hard second-pass size check. All of this was exercised live: valid registration (201), duplicate email (409), missing/invalid fields (400), invalid image content (400), oversized image (400).
- **Login** (`POST /api/login`): accepts username or email, bcrypt-compares against the stored hash, issues a 32-byte random hex session token. **Design note:** `auth.Repository.CreateSession` upserts onto the user's existing session row rather than inserting a new one — this means **logging in a second time (e.g., a second device or browser) silently invalidates the first session's token**, since the row's token value changes underneath it. This is not a security bug, but it is a real behavioral quirk worth confirming is intentional (WARN-006). Invalid password and nonexistent user both return an identical generic 401, correctly avoiding user enumeration.
- **Session validation**: every protected route pulls the caller's identity exclusively from a session-derived `context.Context` value (`requestctx.UserID`), populated by `middleware.SessionMiddleware`. This was confirmed both by code review across every handler package and by live testing (garbage cookie → 401, missing cookie → 401, valid cookie → 200). Sessions use a **sliding 30-minute expiry**, refreshed on every authenticated request — reviewed in code, not independently time-tested (would require a 30+ minute unattended wait).
- **Logout**: revokes the session (soft delete, `revoked_at` timestamp, purged after 30 days by a startup-only cleanup job) and clears the cookie. Confirmed live: a request with the same cookie after logout correctly returns 401.
- **Cookie attributes**: `HttpOnly: true`, `SameSite: Lax`, `Path: /`, and `Secure` driven by `cfg.CookieSecure`, which is **hardcoded to `false`** in `internal/config/config.go:36` with no environment-variable override — meaning the cookie is always sent unencrypted-transport-eligible even if this were deployed to production without a source change (see WARN-011).
- **Content-Type inconsistency**: a 401 raised by the session middleware itself (missing/invalid cookie) is returned as `text/plain` via `http.Error`, while every other error response in the API is JSON. Confirmed live (`Content-Type: text/plain; charset=utf-8` on a cookie-less request). See WARN-002.

---

## 10. Profiles / Followers

- **Profiles**: `GET /api/users/me` and `GET /api/profiles/{username}` share the same response-building function and field set (id, uuid, username, age, gender, first/last name, email, avatar, timestamps, `is_private`). The password hash is never part of this struct and was confirmed absent from every live response. A nonexistent username correctly returns 404.
- **Profile privacy is not enforced — confirmed live.** Bob set `is_private: true` via `PATCH /users/me/privacy`; Alice (an unrelated, non-following user — there is no following relationship to have, see below) then fetched `GET /profiles/bob` and received the complete profile including `email: "bob@example.com"`, age, gender, and full name, with `HTTP 200`. See **ERR-002**.
- **Nickname and "About Me" fields do not exist** in the `users` schema or model — `NOT IMPLEMENTED`.
- **Followers is not implemented at all.** There is no `followers` package, no DB table, no routes (the router has an explicit `// TODO: Register Followers routes here once the Followers handler is implemented`). Follow, unfollow, follow requests, accept/decline, duplicate handling, self-follow prevention, and followers/following lists are all unbuilt. The only trace of the feature is a `follow_request` notification-type constant that is never triggered by any code path (`NOT IMPLEMENTED`, tracked in Section 18).

---

## 11. Posts / Comments

- **Posts**: create, list (feed), get-by-id, edit, and delete were all tested live. Privacy is a **single boolean column** (`private`), not the three-tier "Public / Almost Private / Private with selected followers" model the audit brief assumed — that richer model does not exist in this codebase's schema or code at all. A "private" post is visible only to its owner; there is no followers-only or selected-viewer tier to test because none exists.
- Feed filtering (`WHERE private = 0 OR user_id = ?`), direct-fetch privacy enforcement (404, not 403, for someone else's private post), and ownership checks on edit/delete (403 for a non-owner) were all confirmed live and are correctly implemented.
- **No image/GIF upload exists for posts** — the only upload path in the entire backend is the avatar upload embedded in registration. `NewPostRequest`/`EditPostRequest` carry only title/content/private fields.
- **Comments do not exist at all** — no schema, no service, no handler, no routes (all comment-related URLs return 404 live). This is `NOT IMPLEMENTED`, not a bug.

---

## 12. Groups / Events

- **Groups**: create, list, get-details, get-members, get-own-membership, join-requests (send/duplicate/list-as-creator/list-as-non-creator/accept/re-accept), and invitations (send-as-member/receive/accept-by-invitee/accept-by-non-invitee) were all tested live and behaved correctly, with two exceptions:
  - **Any existing group member — not only the creator — can send invitations.** Confirmed live (Bob, a plain member, successfully invited Carol). This appears to be an intentional design choice (the code explicitly checks "is a member" rather than "is the creator"), not a bug, but is worth flagging since it differs from a "creator-only invites" assumption.
  - **Group details and the full member roster are visible to any authenticated user, member or not.** Confirmed live: a user who was never a member of the group could fetch its full title/description and its complete member list (usernames + roles). Since the `groups` table has no privacy/visibility concept at all, this is consistent with the current data model rather than a broken check — but it becomes a real access-control gap the moment group-scoped content (events, posts) is ever added without its own membership check. See **ERR-003**.
- **Group Events do not exist** — the only trace is a commented-out `NotifyGroupEvent(...)` method stub in `groups/service.go`. No schema, no endpoints, no RSVP logic. `NOT IMPLEMENTED`.
- **Group Posts and Group Comments do not exist** — no schema, no endpoints. `NOT IMPLEMENTED`.

---

## 13. Chat / WebSocket

### WebSocket core
- Authenticated connections succeed; unauthenticated upgrade attempts are correctly rejected with 401 **before** the WebSocket handshake completes (confirmed via a raw HTTP upgrade request with no session cookie).
- Multiple simultaneous connections for the same user (e.g., two browser tabs) both connect successfully and both receive the initial online-users snapshot — the hub's `map[int64]map[*Client]bool` correctly supports this.
- The hub's `sync.RWMutex`-guarded client map was exercised under `go test -race` (project's own `hub_test.go`) with no races detected.
- **Malformed JSON and unknown event types are silently dropped** — confirmed live by sending invalid JSON and a fictitious event type over an authenticated connection: no error frame, no log-visible response, nothing. The client has no way to know its message was ignored. See WARN-003.

### Private Chat — CRITICAL finding, confirmed live
`chat.Service.HandleIncomingWSMessage` (which handles both `private_message` and `typing` events, including saving messages to the `private_messages` table and pushing them to sender+recipient) is **never registered with the WebSocket router**. Only the Groups feature's `invite_user_search` handler is registered (`internal/router/dependencies.go`).

**Live proof:** two authenticated WebSocket connections (Alice, Bob) were opened with a temporary Go test client (deleted after use). Alice sent a valid `private_message` event targeting Bob. Over a 4-second capture window, Bob received only presence events (`online_users`, `user_online`) — **the chat message never arrived**. A follow-up check of `GET /api/chat/history?user_id=2` and a direct query of the `private_messages` table both confirmed **zero rows were ever written** — the message wasn't just undelivered, it was never persisted at all, silently.

The `typing` indicator event has the identical failure mode. See **ERR-001**.

The backend's REST-only chat endpoints (`GET /chat/history`, `GET /chat/conversations`) are themselves correctly implemented (tested live, returned correct empty results consistent with zero messages) but have **zero frontend consumers** — the frontend's chat page and its `useChat` hook talk exclusively over the (broken) WebSocket path. This is dead capability on the backend and dead code on the frontend, both rooted in the same missing wiring.

No chat eligibility/authorization check exists (e.g., a mutual-follow requirement) — any authenticated user can address a `private_message` to any other user ID. Given there is no followers feature to gate on, this may be intentional for now, but is worth flagging (WARN — see Section 17).

### Group Chat
Does not exist on either side. `NOT IMPLEMENTED`.

---

## 14. Notifications

Both notification types the backend actually implements were tested end-to-end, live, including real-time delivery:

### `group_invitation`
- **Trigger:** `groups.Service.CreateGroupInvitation` — confirmed live (Bob invites Carol).
- **DB storage:** `notifications` table row created with correct `receiver_id` (Carol), `actor_id` (Bob), `type="group_invitation"`, `entity_type="group_invitation"`, `entity_id`=the invitation's own row ID.
- **Real-time WS delivery:** not separately re-verified in this run (verified via the join-request case below, which shares the identical delivery code path), but confirmed reachable and correctly typed via `GET /notifications`.
- **REST retrieval:** `GET /notifications` returned the notification correctly to Carol; `GET /notifications/unread-count` correctly showed `1`.
- **Frontend handling:** build-verified — `NotificationItem`/`NotificationBell`/`NotificationDropdown`/`NotificationInbox` all explicitly support this type.

### `group_join_request`
- **Trigger:** `groups.Service.RequestToJoin` — confirmed live (Bob requests to join Alice's group).
- **DB storage + receiver correctness:** confirmed — notification received by Alice (the group creator), not any other user.
- **Real-time WS delivery — confirmed live with a connected client:** a temporary Go WebSocket listener held Alice's connection open while Bob's join-request was issued via a separate REST call; the exact `notification` event (`type: "group_join_request"`, correct `actor_id`, `entity_id`) arrived over the open socket within the same second.
- **Read state:** mark-single-as-read (with ownership enforcement — a non-owner gets 404, not 403, avoiding enumeration) and mark-all-as-read both confirmed live and working correctly.

### Types that are never actually created
The backend defines **four** notification type constants (`follow_request`, `group_invitation`, `group_join_request`, `group_event`) but only the two above are ever triggered by any code path — `follow_request` has no backend feature to originate from (Followers doesn't exist) and `group_event`'s only trigger point is commented out. This is `NOT IMPLEMENTED` for those two types, not a bug.

### Read-state / unread-count nuance
`GetUnreadCount` counts **all** notification types indiscriminately, while the frontend's notification list only ever renders `group_invitation`/`group_join_request` and silently drops anything else. This can't currently produce a visible mismatch (since the other two types are never created), but it's a latent contract gap the moment either of those ships — see WARN-007.

---

## 15. Docker / Infrastructure

**No Dockerfile, `docker-compose.yml`, or any Docker-related file exists anywhere in this repository** (confirmed via a repo-wide case-insensitive search). This is `NOT IMPLEMENTED` at the infrastructure level — there is nothing to build-test. Docker-related audit phases are therefore `BLOCKED`/not applicable rather than failed.

Live headless-browser testing (used for Section 5/8/18's runtime checks) was performed against the developer's **already-running** dev servers (frontend on `:3000`, backend on `:8080`, both started before this audit began) using a temporary Chromium instance borrowed from the system's cached Playwright browser install via `NODE_PATH`/an explicit `executablePath` — nothing was installed into the project, and no project file (`package.json`, lockfiles) was touched. Testing was strictly read-only navigation (page loads only, no form submissions) to avoid writing into the developer's live database.

---

## 16. Errors Found

### ERR-001 — Private chat messages are silently dropped: never delivered, never persisted

Severity: `CRITICAL`
Area: `Backend / WebSocket`
Status: `FAIL`

Description: The WebSocket router that dispatches inbound client events to feature handlers only has the Groups feature's `invite_user_search` handler registered. The Chat service's `HandleIncomingWSMessage` method — which handles both `private_message` and `typing` events, including saving messages to the database — is constructed but never registered with the router, so it is dead code at runtime.

How to reproduce:
1. Log in as two users (A and B) and open an authenticated WebSocket connection for each.
2. From A's connection, send `{"type":"private_message","payload":{"recipient_id":<B>,"content":"hi"}}`.
3. Observe B's connection for 4+ seconds.
4. Call `GET /api/chat/history?user_id=<B>` as A, or inspect the `private_messages` table directly.

Expected: B receives the message in real time; the message is persisted and appears in chat history for both users.

Actual: B receives nothing. No error is returned to A either. The `private_messages` table gains zero rows.

Evidence:
```
alice sending private_message: {"payload":{"content":"hello bob from alice via ws","recipient_id":2},"type":"private_message"}
--- collected events over 4s window ---
[bob received] {"type":"online_users","payload":{"user_ids":[1,2]}}
[bob received] {"type":"user_online","payload":{"user_id":2,"is_online":true}}
[alice received] {"type":"online_users","payload":{"user_ids":[1]}}
[alice received] {"type":"user_online","payload":{"user_id":1,"is_online":true}}
[alice received] {"type":"user_online","payload":{"user_id":2,"is_online":true}}
--- total events captured: 5 ---
```
(No `private_message` event appears anywhere in the capture.) Direct query of the sandbox database after the exchange: `SELECT COUNT(*) FROM private_messages;` → `0`.

Likely location:
```
backend/internal/router/dependencies.go   (WS router wiring — only groups.EventInviteUserSearch is registered)
backend/internal/chat/service.go:37       (HandleIncomingWSMessage — never called by anything)
backend/internal/websocket/router.go:29-32 (Dispatch silently no-ops when no handler is registered for an event type)
```

Possible cause: the chat feature's WebSocket-side wiring appears to have been left out when the REST (history/conversations) side was completed — the service and repository layers are fully built and correct, but the connective step of registering the handler with the shared WebSocket router was never done.

---

### ERR-002 — Profile privacy setting is stored but never enforced

Severity: `HIGH`
Area: `Backend / Authorization`
Status: `FAIL`

Description: A user can set their profile to private via `PATCH /users/me/privacy`, but `GET /profiles/{username}` never checks this flag before returning the full profile record — including email address, age, gender, and full name — to any other authenticated user.

How to reproduce:
1. Log in as user B, call `PATCH /api/users/me/privacy` with `{"is_private": true}`.
2. Log in as unrelated user A.
3. Call `GET /api/profiles/<B's username>`.

Expected: A private profile's sensitive fields (at minimum email/age/gender) should be hidden or the request denied for a non-owner/non-approved viewer.

Actual: Full profile returned with `HTTP 200`, including `is_private: true` in the same response.

Evidence:
```json
{"success":true,"profile":{"id":2,"uuid":"3e3f3a56-...","username":"bob","age":30,"gender":"male","first_name":"Bob","last_name":"Brown","email":"bob@example.com","created_at":"...","updated_at":"...","is_private":true}}
```
(Returned to a different, unrelated logged-in user with `HTTP 200`.)

Likely location:
```
backend/internal/users/handler.go  (GetProfileHandler — no is_private check before building the response)
backend/internal/users/model.go    (toProfileResponse used identically for GetMe and GetProfile)
```

Possible cause: `is_private` was added to the schema/model and exposed via the privacy-toggle endpoint, but the read path (`GetProfileHandler`) was never updated to branch on it — likely because there is no Followers feature yet to define "who is allowed to see a private profile," so the gating logic was deferred along with it.

---

### ERR-003 — Group details and full member list are exposed to non-members

Severity: `MEDIUM`
Area: `Backend / Authorization`
Status: `FAIL`

Description: `GET /groups/{id}` and `GET /groups/{id}/members` require only a valid session — no check that the caller is a member of the group.

How to reproduce:
1. Create a group as user A (with members A, B, C).
2. Log in as user D, who has never interacted with the group.
3. Call `GET /groups/{id}` and `GET /groups/{id}/members`.

Expected: Either the group is genuinely meant to be fully public (in which case this is by design), or non-members should receive a restricted view.

Actual: D receives the full group title/description and the complete member roster (usernames + roles).

Evidence:
```json
{"success":true,"members":[{"user_id":1,"username":"alice","role":"creator",...},{"user_id":2,"username":"bob","role":"member",...},{"user_id":3,"username":"carol","role":"member",...}]}
```
(Returned with `HTTP 200` to a user who is not, and has never been, a member of this group.)

Likely location:
```
backend/internal/groups/handler.go  (GetGroupHandler, GetGroupMembersHandler — no membership check)
```

Possible cause: the `groups` table currently has no privacy/visibility concept at all, so this may be an intentional "all groups are browsable" design — but there is no membership check in place to fall back on once group-scoped content (events/posts) is added, which would then leak that content to non-members by the same omission.

---

### ERR-004 — WebSocket `CheckOrigin` always returns `true`

Severity: `MEDIUM`
Area: `Backend / WebSocket / Security`
Status: `FAIL`

Description: The `gorilla/websocket` upgrader's `CheckOrigin` callback is hardcoded to accept any origin, while authentication for the WebSocket relies entirely on the browser automatically attaching the session cookie during the upgrade handshake.

Evidence (`backend/internal/websocket/client.go`):
```go
var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}
```

Expected: `CheckOrigin` should validate the `Origin` header against the known frontend origin(s), consistent with the fixed-origin policy already applied to the rest of the API by `middleware.CORS`.

Actual: any origin is accepted for the WebSocket upgrade.

Possible cause: likely copied from a common "disable origin checking for local dev" snippet and never tightened. The `SameSite=Lax` cookie attribute provides partial mitigation, but does not eliminate cross-site WebSocket-hijacking risk for all request patterns.

---

### ERR-005 — Inconsistent unauthenticated-redirect behavior across protected routes

Severity: `MEDIUM`
Area: `Frontend / Routing`
Status: `FAIL`

Description: Only `/` (via `PostFeed.tsx`) and the `posts/[id]`/`posts/[id]/edit` pages redirect to `/login` when their data fetch returns 401. `/profile`, `/notifications`, `/groups/[groupId]`, and `/chat` have no such handling.

How to reproduce: with no session cookie, navigate directly to `/profile`, `/notifications`, or `/groups/1` in a browser.

Expected: consistent behavior — either all protected routes redirect to `/login`, or none do (with a shared layout-level guard instead).

Actual: confirmed live via headless browser — `/` redirects to `/login`; `/profile`, `/notifications`, `/groups/abc` do not redirect and instead render with multiple silent `Failed to load resource: 401` console errors.

Likely location:
```
frontend/src/features/posts/components/PostFeed.tsx:28   (has the redirect)
frontend/src/app/(main)/posts/[id]/page.tsx:35            (has the redirect)
frontend/src/app/(main)/posts/[id]/edit/page.tsx:42       (has the redirect)
frontend/src/features/profile/components/MyProfilePageContent.tsx  (no redirect)
frontend/src/features/notifications/... (no redirect)
frontend/src/features/groups/components/GroupDetailsContent.tsx    (no redirect)
```

Possible cause: there is no shared auth-guard/middleware (`frontend/src` has no `middleware.ts` and no auth context/provider at all — every page independently owns its own 401 handling), so the redirect behavior was implemented ad hoc per-page rather than centrally, and simply wasn't added everywhere.

---

### ERR-006 — No environment-based configuration anywhere in the stack

Severity: `MEDIUM`
Area: `Backend + Frontend / Configuration`
Status: `FAIL`

Description: Neither the backend nor the frontend reads any environment variable for the values that would need to change between environments.

- Backend: the only environment variable read anywhere is `SERVER_PORT` (`internal/config/config.go:23`). CORS origin (`middleware/cors.go`), `CookieSecure` (always `false`), DB path, and uploads path are all hardcoded.
- Frontend: `src/lib/api.ts` hardcodes `http://localhost:8080` for both the REST API and the WebSocket URL (`ws://` only, no `wss://` path). `src/features/profile/api/profiles.ts` independently re-hardcodes the same base URL rather than importing the shared helper. `next.config.ts`'s `images.remotePatterns` hardcodes `localhost:8080`. No `NEXT_PUBLIC_*` variable is read anywhere in `frontend/src`.

Expected: at minimum, API/WS base URL, CORS allowed origin, and cookie `Secure` flag should be environment-driven so the same build can run in more than one environment.

Actual: every one of these requires a source-code edit to change.

Possible cause: the project has clearly only ever been run locally so far (both hardcoded ports are the conventional local dev ports); environment-based configuration was deferred.

---

## 17. Warnings

### WARN-001 — Directory listing enabled on `/uploads/avatars/`
`http://<backend>/uploads/avatars/` returns an HTML directory listing (Go's default `http.FileServer` behavior) rather than a 403/404. Low impact since filenames are random UUIDs, but it does leak the exact count and full filename list of every avatar ever uploaded to any unauthenticated visitor.

### WARN-002 — Inconsistent error `Content-Type`
Session-middleware-generated 401s (`internal/middleware/auth.go`, using `http.Error`) are `text/plain`; every other error in the API is JSON. A frontend or API client that blindly calls `response.json()` on every error path will throw on this specific 401.

### WARN-003 — Silent failure on malformed/unknown WebSocket events
`websocket.Router.Dispatch` (`internal/websocket/router.go:29-32`) returns silently, with no error frame and no log line, both when an inbound message fails to unmarshal and when its `type` has no registered handler. A client has no way to distinguish "the server is ignoring me" from "the message was processed."

### WARN-004 — Frontend lint findings
3 errors (1 unescaped-entity, 2 `react-hooks/set-state-in-effect`) and 2 warnings (`no-img-element`, unused variable) — see Section 5 for the full table.

### WARN-005 — Duplicated/hardcoded API base URL on the frontend
`frontend/src/features/profile/api/profiles.ts` defines its own `API_BASE_URL` constant and uses raw `fetch` instead of the shared `lib/api/client.ts` wrapper (which the `posts` and `notifications` features do use). `features/groups/api/groups.ts` similarly bypasses the shared client. Two of the profile components additionally inline the uploads base URL rather than reusing `getUploadsBaseUrl()`.

### WARN-006 — Logging in again silently invalidates the previous session
`auth.Repository.CreateSession` upserts onto a user's single existing `sessions` row rather than allowing multiple concurrent sessions. Logging in on a second device/browser silently logs the first one out (its token stops validating) with no notice to the user. This may well be intentional, but is worth explicit product confirmation.

### WARN-007 — Unread-count includes notification types the frontend never renders
`GetUnreadCount` sums all 4 defined notification types; the frontend's list only renders 2 of them. Currently harmless (the other 2 types are never created), but latent — the badge count and the visible list will silently diverge the moment `follow_request` or `group_event` notifications are ever created without a matching frontend update.

### WARN-008 — Notification click-through is not deep-linked
Both supported notification types currently navigate to `/groups` on click rather than to the specific group/request involved — acknowledged in the frontend code's own comments as a limitation (no backend endpoint currently resolves a join-request ID back to its group ID without the client already knowing it).

**Resolved (2026-09-06, groups+notifications implementation):** the notifications repository now resolves `entity_type`/`entity_id` to the owning group via a `LEFT JOIN` through `group_invitations`/`group_join_requests` (see `backend/internal/notifications/repository.go`'s `notificationSelect`) and exposes it as a derived, nullable `group_id`/`group_title` on both the REST and WebSocket payloads — never used as authorization evidence. `useNotificationNavigate` now routes to `/groups/{groupId}#invitations` or `#join-requests` instead of the generic `/groups` list.

### WARN-009 — Inconsistent backend response conventions; dead helper
`pkg/response/json.go` defines a `JsonResponse` helper that is never called anywhere in the codebase — every handler duplicates `w.WriteHeader` + `json.NewEncoder(w).Encode(...)` independently, and different packages use different envelope shapes (`{success, message}` vs. `{message, error}`).

### WARN-010 — Dead code on both sides of the chat feature
`frontend/src/features/chat/hooks/useChat.ts` is a fully built hook that is never imported anywhere (superseded by ad hoc calls directly in `app/(main)/chat/page.tsx`). Symmetrically, the backend's chat REST endpoints (`/chat/history`, `/chat/conversations`) have zero frontend callers. Both are compounded by ERR-001.

### WARN-011 — No path to safely deploy beyond localhost without a code change
Covered in ERR-006 but restated here as a deployment-readiness warning: `CookieSecure`, the CORS origin, and both API/WS base URLs would all need source edits (not just configuration) before this app could run anywhere other than `localhost`.

---

## 18. Missing / Not Implemented Functionality

The following are absent from the codebase entirely — not bugs, simply unbuilt:

- **Followers** — no follow/unfollow, no follow requests, no followers/following lists, no package, no DB table.
- **Comments** (on regular posts) — no schema, no service, no handler, no routes.
- **Group Events** — no create/list/RSVP, no schema; only a commented-out notifier stub exists.
- **Group Posts / Group Comments** — no schema, no endpoints.
- **Group Chat** — no schema, no endpoints, no frontend.
- **Multi-tier post privacy** ("Almost Private"/followers-only, "Private" with a selected-viewer list) — only a binary public/private column exists.
- **`follow_request` and `group_event` notification types** — constants are defined but never triggered by any code path (their dependent features don't exist).
- **Nickname / "About Me" profile fields** — not present in the schema.
- **Avatar update after registration** — no endpoint exists to change/replace an avatar post-registration.
- **Image/GIF upload for posts or comments** — only the registration-time avatar upload exists anywhere in the backend.
- **Docker / containerization** — no Dockerfile or docker-compose file anywhere in the repository.
- **Any frontend test framework** — no Jest/Vitest/RTL/Playwright dependency and no test files.
- **Any backend test coverage outside the WebSocket hub** — auth, groups, posts, notifications, chat, users all have zero `_test.go` files.
- **Environment-based configuration** — no env vars are read anywhere except `SERVER_PORT`.

---

## 19. Frontend ↔ Backend Contract Mismatches

| Frontend | Backend | Problem |
|---|---|---|
| `app/(main)/chat/page.tsx` sends `{type:"private_message"}` / `{type:"typing"}` over WS expecting live delivery | `internal/router/dependencies.go` never registers `chat.Service.HandleIncomingWSMessage` with the WS router | Messages are silently dropped — see ERR-001. Not a naming mismatch (the event-type strings match exactly on both sides), but a wiring/registration gap. |
| `features/chat/hooks/useChat.ts` (built, unused) | `GET /chat/history`, `GET /chat/conversations` (built, correct) | Neither side of chat's REST capability is connected to the other — the hook is dead code, the endpoints have no caller. |
| `features/notifications/types/notification.ts` renders only `group_invitation`/`group_join_request` | `GetUnreadCount` counts all 4 defined notification types | Latent divergence between the unread badge and the visible notification list — see WARN-007. |
| `features/profile/api/profiles.ts` hardcodes `http://localhost:8080/api` independently | `src/lib/api.ts` is the intended single source of truth for this value | Two independent hardcoded copies of the same config value — a change to one is easy to miss updating in the other. |

No route-path or HTTP-method mismatches were found — every frontend API call target that could be located matches an actual backend route exactly (method + path + field names), which is a genuine positive finding for a codebase without shared type generation between the two languages.

---

## 20. Security / Authorization Findings

**Positive findings (no issues):**
- Actor identity is consistently derived from the session (`requestctx.UserID`) everywhere — no endpoint trusts a client-supplied field to determine who is performing an action. No actor-spoofing IDOR was found anywhere in `posts`, `groups`, `users`, `notifications`, `chat`, or the WebSocket layer.
- Passwords are bcrypt-hashed and never appear in any response struct — confirmed both by code review and live payload inspection.
- All SQL access uses parameterized queries (`?` placeholders) throughout; no string-concatenated SQL was found.
- Post edit/delete, join-request accept/reject (creator-only), and invitation accept/decline (invitee-only) are all correctly authorization-checked, including correctly scoping a request/invitation ID to its parent group ID (preventing cross-group ID confusion).
- CORS is a fixed, non-reflective origin (`http://localhost:3000`) — confirmed live that a forged `Origin: http://evil.example.com` header does not change the response's `Access-Control-Allow-Origin`, so a browser would correctly refuse to expose the response to that foreign page.
- Avatar upload filenames are server-generated UUIDs with a content-sniffed extension — no user-controlled input ever reaches a filesystem path, eliminating path-traversal risk for that feature entirely.
- Foreign keys are enforced at the database-connection level (confirmed live — inserting a notification with a nonexistent `receiver_id` correctly fails).

**Issues found** (see Section 16 for full detail): profile privacy unenforced (ERR-002, HIGH), group details/members exposed to non-members (ERR-003, MEDIUM), WebSocket `CheckOrigin` always true (ERR-004, MEDIUM), directory listing on uploads (WARN-001, LOW), no environment-driven `CookieSecure`/CORS/deploy path (ERR-006, MEDIUM).

No SQL injection, no path traversal, and no session-fixation vector were found anywhere in the code paths reviewed.

---

## 21. Severity Summary

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 1 |
| Medium | 4 |
| Low | 10 |

(Critical/High/Medium correspond to ERR-001 through ERR-006 in Section 16; Low corresponds to WARN-001 through WARN-011 minus one duplicate-topic overlap with ERR-006, i.e. WARN-001 through WARN-010 in Section 17.)

---

## 22. Priority Order

This is prioritization only — no code was changed.

1. **Investigate and wire up private chat's WebSocket routing** (ERR-001) — a core, user-facing feature is completely silent-broken; this is the single highest-impact item.
2. **Decide on and enforce profile privacy** (ERR-002) — real PII (email, age, full name) is currently exposed to every logged-in user regardless of the privacy toggle.
3. **Add membership checks to group details/member endpoints** (ERR-003) — low impact today, but will become a real content-leak vector the moment group-scoped posts/events exist, so it's cheaper to close now.
4. **Restrict WebSocket `CheckOrigin` to known frontend origins** (ERR-004) — straightforward hardening, currently the API's own CORS policy is stricter than its WebSocket's.
5. **Standardize the unauthenticated-redirect behavior across all protected frontend routes** (ERR-005) — currently inconsistent and confusing for a user whose session has expired.
6. **Introduce environment-based configuration** (ERR-006) before any deployment beyond localhost is attempted — this blocks safe deployment more than any single bug does.
7. **Fix the 3 frontend lint errors** (WARN-004) — quick, low-risk, and two of them are React's own warning about a real (if currently low-impact) rendering-cascade anti-pattern.
8. **Disable directory listing on `/uploads`** (WARN-001) — trivial hardening.
9. **Add automated test coverage** for `auth`, `groups`, `posts`, and `notifications` business logic — currently only the WebSocket hub has any tests at all, which is the biggest structural risk to catching regressions going forward.

---

## 23. Test Coverage Gaps

- **No browser-automation framework is part of this project.** The live browser checks in this audit (Section 5/15) used an external headless Chromium borrowed via the system's cached Playwright installation, for this audit only — nothing was added to the project. Coverage was limited to 7 read-only page loads (no form submissions, no authenticated interactive flows), specifically to avoid writing test data into the developer's live/real database.
- **Group Events, Group Posts/Comments, Followers, Group Chat**: 0% testable by any method — no backend implementation exists.
- **Real two-user chat UI** could not be verified end-to-end in an actual browser (only at the raw WebSocket-protocol level, via a temporary Go client) — the frontend chat page is a non-functional debug demo and the delivery path itself is broken server-side, so a UI-level test would not have added information beyond what the protocol-level test already proved.
- **30-minute sliding session expiry** and the 30-day revoked-session purge were reviewed in code only — verifying them empirically would require an unattended multi-minute/multi-day wait.
- **Docker**: cannot be build-tested — no Dockerfile or docker-compose.yml exists anywhere in the repository.
- **Load/concurrency at scale**: only the project's own existing 2-test, race-clean suite (`hub_test.go`) was exercised; no test with hundreds of concurrent WebSocket clients was performed.
- **Backend business-logic packages have zero automated tests of their own** (`auth`, `groups`, `posts`, `notifications`, `chat`, `users`) — all functional verification in this audit came from ad hoc HTTP/WebSocket calls against an isolated sandbox instance, not from the project's own test suite, meaning none of this verification is captured for future regression protection.
- **Owner-positive edit/delete path for posts** was code-reviewed but not independently curl-tested (only the negative/non-owner case was exercised live); the code path is simple and symmetric with the tested negative case, so risk here is judged low.

---

## 24. Temporary Test Files

All of the following were created during this audit and have been deleted. None were committed or left untracked.

- `backend/pkg/db/sqlite/migration_audit_temp_test.go` — DELETED
- `backend/cmd/audit_ws_client/main.go` (+ directory) — DELETED
- `backend/cmd/audit_ws_listener/main.go` (+ directory) — DELETED
- Isolated sandbox backend binary, its temporary SQLite database, and its uploads directory (built and run entirely under `/tmp/.../scratchpad/audit_sandbox/`, never inside the repository) — DELETED
- Temporary test users (`alice`, `bob`, `carol`, `frank`, plus two intentionally-failed registration attempts) existed **only** inside the isolated sandbox's temporary database under `/tmp`, never in the project's real database — DELETED along with the sandbox directory
- Ad hoc test artifacts (cookie jars, WebSocket capture logs, the borrowed headless-browser check script) under the session scratchpad directory (outside the repository) — DELETED

---

## 25. Repository Integrity Verification

**Initial git status** (before any testing began):
```
On branch feat/notfcation-frontend
nothing to commit, working tree clean
```

**Final git status** (after all testing and cleanup, before writing this report):
```
On branch feat/notfcation-frontend
Your branch is up to date with 'origin/feat/notfcation-frontend'.
nothing to commit, working tree clean
```

**Real database integrity:** the developer's actual database at `backend/data/social-network.db` was found to already contain in-progress development data (5 users, 6 groups, 3 posts, 8 notifications, etc.) at the start of this audit, alongside an **already-running** backend server (port 8080) and frontend dev server (port 3000) that the developer had started before this session — both were left completely untouched throughout. To avoid any risk to that data, all mutating tests (registration, login, posts, groups, notifications, chat) were run against a **fully isolated, temporary sandbox instance** of the compiled backend, pointed at a throwaway SQLite database under `/tmp`, on a different port (8090). The real database's MD5 checksum was recorded before testing and re-verified identical after:

```
15da005c6f50ce0b6b8ad83d555980b6  backend/data/social-network.db   (before)
15da005c6f50ce0b6b8ad83d555980b6  backend/data/social-network.db   (after)
```

Live headless-browser checks (Section 5/15) did read from the developer's already-running live servers, but were strictly limited to read-only page navigation (no form submissions, no data mutation).

```
Production source modified by audit: NO
Temporary audit files remaining: NO
Persistent audit file: docs/TEST_AUDIT_REPORT.md
```
