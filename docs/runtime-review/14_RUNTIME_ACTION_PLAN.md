# 14. Runtime Action Plan & Remediation Roadmap

This action plan provides a prioritized, dependency-ordered blueprint for subsequent engineering agents to resolve defects discovered during dynamic runtime auditing.

---

## Phase 0: Critical Security & Session Privacy

### 0.1 Terminate WebSocket Connections on Logout (`RT-WS-001`)
- **Subsystem:** `backend/internal/auth`, `backend/internal/websocket`
- **Actions:**
  1. Pass `*websocket.Hub` into `auth.NewHandler`.
  2. In `LogoutHandler`, invoke `h.hub.DisconnectUser(int64(userID))` before writing HTTP response headers.
  3. In `websocket/hub.go`, add `DisconnectUser(userID int64)`: acquire write lock, iterate all client connections for that user, dispatch a `CloseNormalClosure` (1000) frame, close channels, and unregister them.
  4. In `dependencies.go` WebSocket message dispatcher, add an inexpensive session revocation sanity check or heartbeat validator.
- **Verification:** Establish WebSocket -> issue REST logout -> assert socket transitions to `CLOSED` within 200ms and cannot send further messages.

### 0.2 Enable Multi-Session Concurrency Per User (`RT-SESSION-001`)
- **Subsystem:** `backend/internal/auth/repository.go`
- **Actions:**
  1. Replace the existing `UPDATE sessions ... WHERE user_id = ?` query in `CreateSession` with an `INSERT INTO sessions (id, user_id, session_token, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)`.
  2. Ensure the SQLite schema supports multiple sessions per `user_id` (foreign key indexing on `user_id`, unique constraint on `session_token`).
  3. Ensure session cleanup deletes all expired records across all sessions.
- **Verification:** Log in on two distinct browser contexts -> perform actions on both -> assert neither receives 401.

---

## Phase 1: Deployment, Networking & CORS Configuration

### 1.1 Dynamic CORS Origin Resolution (`RT-CONTRACT-001`)
- **Subsystem:** `backend/internal/middleware/cors.go`
- **Actions:**
  1. Update `CORS` middleware to inspect incoming request `Origin` header.
  2. Check `Origin` against a configurable whitelist (e.g. `localhost:3000`, `127.0.0.1:3000`, LAN IPs, or environment variable `CORS_ALLOWED_ORIGINS`).
  3. Dynamically set `Access-Control-Allow-Origin` to the matched origin, preserving `Access-Control-Allow-Credentials: true`.
- **Verification:** Preflight OPTIONS request with `Origin: http://192.168.100.24:3000` returns matching `Access-Control-Allow-Origin: http://192.168.100.24:3000`.

### 1.2 Frontend Environment Variable Integration (`RT-CONTRACT-002`)
- **Subsystem:** `frontend/src/lib/api.ts`
- **Actions:**
  1. Refactor `getBackendBaseUrl()` to read `process.env.NEXT_PUBLIC_BACKEND_ORIGIN` with fallback to `DEFAULT_BACKEND_ORIGIN`.
  2. Refactor `getWebSocketUrl()` to read `process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN` or compute from `NEXT_PUBLIC_BACKEND_ORIGIN`.
- **Verification:** Build frontend with custom backend origin -> assert fetch and WebSocket target the configured address.

---

## Phase 2: WebSocket Hygiene & Reconnect Stability

### 2.1 Scope `WebSocketProvider` to Authenticated Shell (`RT-WS-002`)
- **Subsystem:** `frontend/src/app/layout.tsx`, `frontend/src/app/(main)/layout.tsx`
- **Actions:**
  1. Remove `<WebSocketProvider>` from `src/app/layout.tsx`.
  2. Mount `<WebSocketProvider>` inside `src/app/(main)/layout.tsx` so it only activates when an authenticated session is active.
  3. Add an explicit authentication guard in `useWebSocket` so unauthenticated pages never trigger connection attempts.
- **Verification:** Open `/login` and `/register` -> assert 0 WebSocket connection attempts appear in console or server logs.

---

## 3. Phase 3: Media & Static File Security

### 3.1 Disable Open Directory Listing on Static Uploads (`RT-UPLOAD-001`)
- **Subsystem:** `backend/internal/router/router.go`
- **Actions:**
  1. Replace direct `http.FileServer(http.Dir(cfg.UploadsDir))` with a restricted file system handler that checks `fi.IsDir()` and returns `http.StatusNotFound` or `http.StatusForbidden`.
- **Verification:** `curl -I http://localhost:8080/uploads/` returns 404/403, while `curl -I http://localhost:8080/uploads/avatars/<uuid>.png` returns 200.

---

## 4. Phase 4: API Semantics & Schema Uniformity

### 4.1 Unauthenticated `GET /api/login` Return Code (`RT-AUTH-001`)
- **Subsystem:** `backend/internal/auth/handler.go`
- **Actions:**
  1. In `LoginHandler`, return `401 Unauthorized` with `{"error": "Unauthorized"}` when a GET request is received without a valid session cookie, rather than falling through to 405.
- **Verification:** `curl -s http://localhost:8080/api/login` returns `HTTP 401 Unauthorized`.

---

## 5. Phase 5: Automated E2E Regression Coverage

### 5.1 Test Suite Implementation
- Create an automated Playwright regression suite covering:
  - Multi-user authentication & concurrent sessions
  - Directional follow approval/rejection state transitions
  - Post privacy matrix (Owner, Follower, Non-follower, Custom audience)
  - Realtime private chat delivery and typing indicators
  - Group membership revocation during active chat
  - Realtime notification delivery with monotonic merge validation

