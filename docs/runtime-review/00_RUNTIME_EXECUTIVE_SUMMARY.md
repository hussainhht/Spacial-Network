# Runtime & E2E Audit — Executive Summary

## 1. Scope

This dynamic runtime audit evaluated the Social Network application by actively running both the Go backend and Next.js frontend services, creating real disposable user datasets, executing state transitions across multiple concurrent browser contexts and WebSocket clients, testing authorization and privacy boundaries directly via HTTP/WebSocket wire protocols, and testing edge cases across tabs and devices.

The audit was conducted strictly non-destructively: application source code, schema migrations, and configuration were not modified.

---

## 2. Environment

- **Repository Root:** `/home/hussain-hht/Desktop/ss2/social-network`
- **Branch / Commit:** `feat/auth-regester-page` / `0fa6276fd2daff461a33b47aa599324f0bfa02b0`
- **Backend Service:** Native Go 1.26 process running on `http://localhost:8080`
- **Frontend Service:** Next.js 16.3.2 (Turbopack) with React 19.2.8 running on `http://localhost:3000`
- **Database:** SQLite3 with WAL mode, single-connection pool serialization, and embedded migrations
- **WebSocket Transport:** Gorilla WebSocket at `ws://localhost:8080/api/ws`
- **Automation Tools:** Node.js 24 native WebSocket client, Python 3 requests, and Playwright 1.63.0 Headless Chromium

---

## 3. Overall Runtime Health

The overall runtime health of the core application is **strong**:
- All 30 database migrations executed cleanly on startup.
- The standard library `net/http.ServeMux` router correctly manages all 43 registered API endpoints.
- Real-time WebSocket multiplexing reliably routes private messaging, group broadcasts, typing indicators, read receipts, and notification events.
- Post privacy (`public`, `followers`, `custom`) is strictly enforced at the database query layer.
- SQLite concurrency contention is effectively mitigated by single-connection serialization (`SetMaxOpenConns(1)`).

However, critical runtime defects were identified in **session concurrency**, **WebSocket authorization post-logout**, and **network deployment flexibility**.

---

## 4. Requirements Runtime Snapshot

| Requirement Domain | Runtime Scenario Tested | Dynamic Result | Observed Evidence | Issue ID |
|---|---|:---:|---|:---:|
| **User Registration** | Multipart registration with validation rules | **PASS** | Status 201 on valid, 400 on invalid/missing fields, 409 on duplicate | - |
| **User Login & Session** | Username/email login, cookie issuance | **PASS** | Status 200, HttpOnly SameSite=Lax cookie issued | - |
| **Concurrent Sessions** | Same user logging in on two browsers/tabs | **FAIL** | Device B login overwrites Token A in DB, invalidating Device A with 401 | **RT-SESSION-001** |
| **Profile Privacy** | Non-follower viewing private profile | **PASS** | Sensitive biographical data masked; followers list blocked with 403 | - |
| **Follow Requests** | Private user follow request approval flow | **PASS** | State transitions: `requested` -> `following` on accept, `none` on decline | - |
| **Follow Scoping** | Non-target approving follow request | **PASS** | Returns 404 Not Found (scoping prevented unauthorized acceptance) | **RT-FOLLOW-001** |
| **Post Privacy Matrix** | Owner, Follower, Non-Follower, Custom audience | **PASS** | Direct GET/comments return 200 for allowed viewers, 404 for unauthorized | - |
| **Comments & Likes** | Comment creation, like/unlike toggling | **PASS** | Likes are idempotent; comments inherit post access boundaries | - |
| **Group Privacy** | Private group discoverability & access | **PASS** | Private groups hidden from directory; direct GET returns 404; join requests return 403 | - |
| **Group Join Requests** | Public group join request approval by creator | **PASS** | Status 201 on request; 403 on non-creator approval; 200 on creator approval | - |
| **Group Invitations** | Creator invites user; member tries to invite | **PASS** | Members blocked with 403; creator invites with 201; invitee accepts with 200 | **RT-GROUP-001** |
| **Private Chat** | 1-on-1 messaging with follow requirement | **PASS** | Allowed between mutual/one-way follows; blocked for non-connected with WS error | - |
| **Group Chat Broadcast** | Real-time broadcast to group members | **PASS** | All active members receive frame; non-members receive 0 frames and cannot send | - |
| **Chat Membership Revocation** | Removing member during active WebSocket session | **PASS** | Member immediately excluded from broadcast and blocked from sending on existing socket | - |
| **WebSocket Logout Invalidation** | Sending message after session logout | **FAIL** | Logged-out socket remains open and continues to send/receive messages | **RT-WS-001** |
| **Notifications Push** | Real-time push for likes, comments, invites | **PASS** | Frame delivered over WS within 20ms; unread count increments accurately | - |
| **Notification Race Condition** | Monotonic merge against stale REST responses | **PASS** | `isRead: incoming \|\| existing` prevents read state regression | - |
| **Media Uploads** | Avatar and attachment uploads with sniffing | **PASS** | Valid PNG/GIF accepted; spoofed text and oversized files rejected with 400 | - |
| **Uploads Directory Exposure** | Browsing root `/uploads/` route | **FAIL** | Server returns open directory listing of uploaded UUID files and folders | **RT-UPLOAD-001** |
| **CORS / Network Flexibility** | Preflight OPTIONS from non-localhost origin | **FAIL** | Backend strictly responds with hardcoded `http://localhost:3000` | **RT-CONTRACT-001** |

---

## 5. Issue Counts

| Severity | Count | Primary Impact Areas |
|---|---:|---|
| **Critical** | 0 | None |
| **High** | 3 | WebSocket session survival post-logout, single-session DB overwrite, static CORS origin |
| **Medium** | 3 | Unauthenticated WS reconnect loop, frontend hardcoded base URL, static uploads directory listing |
| **Low** | 1 | Unauthenticated `GET /api/login` returning 405 instead of 401 |
| **Info** | 5 | REST array conventions, parameter naming requirements, creator-only invites, WebP policy |
| **Total** | **12** | Full system coverage |

---

## 6. Critical & High Runtime Findings

1. **RT-WS-001 (High) — WebSocket Connection Survives Logout:**
   When a user clicks "Logout", the backend successfully clears the session cookie and updates SQLite `sessions SET revoked_at = CURRENT_TIMESTAMP`. However, the server does **not** close the user's active WebSocket connection, and the WebSocket message router does **not** re-verify session validity. The logged-out socket remains fully functional for sending and receiving private and group messages indefinitely.
2. **RT-SESSION-001 (High) — Single Concurrent Session Overwrite:**
   The backend database design treats sessions as a 1-to-1 relationship per user (`UPDATE sessions SET session_token = ? WHERE user_id = ?`). Logging in from a second browser, tab, or mobile device immediately invalidates the first session, forcing an unexpected logout on the user's primary device.
3. **RT-CONTRACT-001 (High) — Static CORS Origin Whitelist:**
   `middleware.CORS` hardcodes `Access-Control-Allow-Origin: http://localhost:3000`. When accessed via LAN IP (`http://192.168.x.x:3000`), loopback alias (`http://127.0.0.1:3000`), or container hostnames, browser security blocks all credentialed API calls.

---

## 7. Important Medium Findings

1. **RT-WS-002 (Medium) — Unauthenticated WebSocket Connection Loop:**
   `WebSocketProvider` is mounted at the root Next.js layout. Unauthenticated visitors on `/login` and `/register` trigger connection attempts to `ws://localhost:8080/api/ws` every 1500ms, receiving continuous 401 errors.
2. **RT-UPLOAD-001 (Medium) — Open Directory Listing on `/uploads/`:**
   Standard library `http.FileServer` serves HTML directory indexes for `/uploads/`, exposing all uploaded media UUIDs and subfolders to unauthenticated directory enumeration.
3. **RT-CONTRACT-002 (Medium) — Frontend API Client Hardcodes Localhost:**
   `getBackendBaseUrl()` and `getWebSocketUrl()` in `frontend/src/lib/api.ts` hardcode `localhost:8080`, ignoring environment variables passed in containerized deployments.

---

## 8. Flows That Passed Completely

- Multi-step registration validation and password hashing (bcrypt cost 10).
- Public profile data exposure vs private profile cloaking.
- Directional follow requests, creator approval, decline flows, and self-follow blocking.
- Post privacy tier enforcement across 5 distinct personas (Owner, Follower, Non-follower, Custom audience).
- Comments creation, post comment counts, and like/unlike idempotency.
- Public group discovery, join request workflows, and creator-only approval scoping.
- Private group hiding from discovery and invite-only enforcement.
- Group events creation with future-date validation and `going`/`not_going` RSVP toggling.
- Real-time 1-on-1 chat delivery, typing indicators, read receipts, and offline message persistence.
- Group chat multi-member broadcast and real-time membership revocation during active socket use.
- Real-time notification dispatch and client-side monotonic read merge protection.
- Magic-byte MIME sniffing on image uploads rejecting spoofed files and oversized uploads.

---

## 9. Flows Blocked / Not Tested

- **Full Native Docker Compose End-to-End Build:** Blocked from executing full container startup during audit to avoid resource contention on the local development system. Validated via `docker compose config` and static file inspection instead.
- **Push Notifications (Mobile APNS/FCM):** Not implemented in codebase (system relies entirely on in-app WebSockets).

---

## 10. Findings Especially Useful to the Static Audit

The concurrent static code review should specifically inspect:
1. **`backend/internal/auth/handler.go` (`LogoutHandler`):** Inspect why `LogoutHandler` lacks dependency injection for the WebSocket `Hub` and fails to call `hub.DisconnectUser(userID)`.
2. **`backend/internal/auth/repository.go` (`CreateSession`):** Inspect the `SELECT 1 FROM sessions WHERE user_id = ?` check that causes in-place token overwrites instead of appending multi-session rows.
3. **`backend/internal/middleware/cors.go`:** Inspect why CORS origin handling is hardcoded rather than dynamically reflecting or reading configuration.
4. **`frontend/src/lib/api.ts`:** Inspect why `DEFAULT_BACKEND_ORIGIN` and `process.env.NEXT_PUBLIC_BACKEND_ORIGIN` are bypassed in favor of hardcoded template literals.
5. **`backend/internal/router/router.go` (`http.FileServer`):** Inspect the mount at `/uploads/` where directory listing is permitted by default.

---

## 11. Highest-Risk Integration Areas

1. **Authentication State Desynchronization:** The disconnect between SQLite session invalidation and persistent WebSocket channel state is the highest runtime security risk.
2. **Multi-Tab Session Clashing:** Users opening the app across tabs or logging in again inadvertently terminate their existing sessions.
3. **Containerized Port & Origin Mismatches:** Deploying this system to any non-localhost URL will cause immediate CORS and WebSocket connectivity failures unless origins and endpoints are made configurable.

---

## 12. Recommended Next Step

Proceed to execute **Phase 0 and Phase 1 of `14_RUNTIME_ACTION_PLAN.md`**, specifically:
1. Wire `*websocket.Hub` into `auth.LogoutHandler` to close sockets upon logout (`RT-WS-001`).
2. Update `CreateSession` in `auth/repository.go` to support multiple sessions per user (`RT-SESSION-001`).
3. Make CORS middleware origin matching dynamic (`RT-CONTRACT-001`).

