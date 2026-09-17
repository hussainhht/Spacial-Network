# 13. Runtime Issue Register

## 1. Issue Summary Tables

### By Severity

| Severity | Count |
|---|---:|
| **Critical** | 0 |
| **High** | 3 |
| **Medium** | 3 |
| **Low** | 1 |
| **Info** | 5 |
| **Total** | **12** |

### By Domain

| Domain | Critical | High | Medium | Low | Info | Total |
|---|---:|---:|---:|---:|---:|---:|
| **Authentication & Sessions** | 0 | 1 | 0 | 1 | 0 | **2** |
| **WebSockets & Realtime** | 0 | 1 | 1 | 0 | 0 | **2** |
| **Contract & Configuration** | 0 | 1 | 1 | 0 | 0 | **2** |
| **Uploads & Static Storage** | 0 | 0 | 1 | 0 | 1 | **2** |
| **Posts & Feeds** | 0 | 0 | 0 | 0 | 1 | **1** |
| **Groups & Events** | 0 | 0 | 0 | 0 | 2 | **2** |
| **Chat & Messaging** | 0 | 0 | 0 | 0 | 1 | **1** |
| **Total** | **0** | **3** | **3** | **1** | **5** | **12** |

---

## 2. Issue Inventory & Detailed Reports

### RT-WS-001 — WebSocket Connection Survives User Session Logout

**Severity:** High  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Frontend: Next.js 16.3.2 / React 19
- Backend: Go 1.26 stdlib + Gorilla WebSocket
- Client: Node.js WebSocket & Headless Chromium
- Transport: WebSocket (`ws://localhost:8080/api/ws`)

**Preconditions:**
User is logged in and has an active WebSocket connection established at `/api/ws`.

**Steps to reproduce:**
1. Log in as Alice via `POST /api/login`.
2. Connect WebSocket to `ws://localhost:8080/api/ws` with `Cookie: session_token=...`.
3. Submit `POST /api/logout` via REST. Observe `200 OK` and session token revoked in SQLite.
4. Verify `ws.readyState` on Alice's client.
5. Send a `private_message` WebSocket frame to Bob.

**Expected result:**
Logging out should terminate or close the user's active WebSocket connection(s), or the message dispatcher should reject frames from revoked sessions.

**Actual result:**
The WebSocket remains in state `OPEN` (1). The server processes the private message, saves it to SQLite, and delivers it to Bob in real time.

**Observed evidence:**
```text
Alice logs out via REST POST /api/logout
Logout response: 200 {"message":"Logged out"}
Alice WebSocket readyState after logout: 1 (OPEN)
Did Bob receive message sent by logged-out Alice?: true
```

**Likely subsystem:**
`backend/internal/auth/handler.go` (`LogoutHandler`) does not notify `websocket.Hub`, and `backend/internal/router/dependencies.go` (`wsHandler.SetMessageHandler`) does not validate session revocation on inbound frames.

**Requirement affected:**
Authentication & Session Security.

**Recommended fix direction:**
Inject the WebSocket `Hub` into `auth.Handler` and call `hub.DisconnectUser(userID)` on logout; alternatively, validate session status periodically or per mutation frame.

**Recommended regression test:**
Connect WebSocket -> send logout HTTP request -> assert WebSocket receives close frame (code 1000/1008) within 500ms.

---

### RT-SESSION-001 — Single Concurrent Session Limit Per User Account

**Severity:** High  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Frontend: Next.js 16.3.2
- Backend: Go 1.26
- Database: SQLite `sessions` table
- Transport: HTTP REST

**Preconditions:**
User account exists.

**Steps to reproduce:**
1. Log in as Alice on Browser A / Tab 1. Token A is issued.
2. Log in as Alice on Browser B / Device 2. Token B is issued.
3. Attempt any authenticated request (e.g. `GET /api/users/me`) from Browser A with Token A.

**Expected result:**
Multiple concurrent sessions across tabs or devices should be supported independently.

**Actual result:**
Browser A receives `401 Unauthorized: invalid session`.

**Observed evidence:**
```sql
UPDATE sessions
SET session_token = ?, created_at = ?, expires_at = ?, revoked_at = NULL
WHERE user_id = ?
```
Token A is overwritten in SQLite by Token B.

**Likely subsystem:**
`backend/internal/auth/repository.go` (`CreateSession`).

**Requirement affected:**
Multi-device / multi-tab session management.

**Recommended fix direction:**
Change `CreateSession` to `INSERT INTO sessions ...` allowing multiple rows per `user_id` rather than updating existing user rows in place.

**Recommended regression test:**
Issue two logins for same user -> verify both session cookies remain valid concurrently.

---

### RT-CONTRACT-001 — Rigid Hardcoded CORS Origin Blocks Non-Localhost Access

**Severity:** High  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Backend: Go 1.26 `middleware.CORS`
- Transport: HTTP Preflight OPTIONS

**Preconditions:**
Server running on port 8080.

**Steps to reproduce:**
1. Issue OPTIONS request to `http://localhost:8080/api/users/me` with header `Origin: http://192.168.100.24:3000` or `http://127.0.0.1:3000`.
2. Inspect `Access-Control-Allow-Origin` header in response.

**Expected result:**
The backend should dynamically echo the allowed origin or read allowed origins from configuration.

**Actual result:**
Backend responds with hardcoded `Access-Control-Allow-Origin: http://localhost:3000`. Browsers reject credentialed requests from any alternate host.

**Observed evidence:**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: http://localhost:3000
```

**Likely subsystem:**
`backend/internal/middleware/cors.go`.

**Requirement affected:**
LAN testing, Docker Compose networking, and deployed staging environments.

**Recommended fix direction:**
Parse allowed origins from environment variables or reflect the incoming origin if it matches an allowed whitelist.

**Recommended regression test:**
Send OPTIONS with `Origin: http://127.0.0.1:3000` -> assert `Access-Control-Allow-Origin: http://127.0.0.1:3000`.

---

### RT-WS-002 — Unconditional WebSocket Connection Loop on Unauthenticated Routes

**Severity:** Medium  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Frontend: Next.js 16.3.2 (`WebSocketProvider.tsx`, `layout.tsx`)
- Backend: Go 1.26 (`SessionMiddleware`)

**Preconditions:**
Browser is unauthenticated (no session cookie).

**Steps to reproduce:**
1. Navigate to `http://localhost:3000/login` or `http://localhost:3000/register`.
2. Inspect browser network tab and server console.

**Expected result:**
Unauthenticated pages should not initiate authenticated WebSocket connections.

**Actual result:**
`WebSocketProvider` mounts in `RootLayout` and attempts connection every 1500ms, receiving `401 Unauthorized: Cookie Not Found` repeatedly.

**Observed evidence:**
```text
WebSocket connection to 'ws://localhost:8080/api/ws' failed: HTTP Authentication failed; no valid credentials available
WebSocket connection notice (normal if logged out or server restarted)
```

**Likely subsystem:**
`frontend/src/app/layout.tsx` and `frontend/src/providers/WebSocketProvider.tsx`.

**Requirement affected:**
Network performance and error logging hygiene.

**Recommended fix direction:**
Move `WebSocketProvider` into authenticated route layout `(main)/layout.tsx`, or guard `connectSocket()` with an auth-check hook (`useAuth`).

**Recommended regression test:**
Open `/login` with clean context -> verify 0 WebSocket connection attempts occur before login.

---

### RT-CONTRACT-002 — Frontend API Client Ignores Configuration Environment Variables

**Severity:** Medium  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Frontend: Next.js 16.3.2
- File: `frontend/src/lib/api.ts`

**Preconditions:**
Environment variables `NEXT_PUBLIC_BACKEND_ORIGIN` or `NEXT_PUBLIC_BACKEND_WS_ORIGIN` provided in Dockerfile or `.env`.

**Steps to reproduce:**
1. Inspect `getBackendBaseUrl()` and `getWebSocketUrl()` in `frontend/src/lib/api.ts`.

**Expected result:**
Helper functions should read `process.env.NEXT_PUBLIC_BACKEND_ORIGIN` and fall back to `http://localhost:8080`.

**Actual result:**
Hardcoded template string `http://localhost:8080` is returned unconditionally.

**Observed evidence:**
```typescript
export function getBackendBaseUrl(): string {
  return `http://localhost:${BACKEND_PORT}`;
}
```

**Likely subsystem:**
`frontend/src/lib/api.ts`.

**Requirement affected:**
Docker container orchestration and production deployments.

**Recommended fix direction:**
Update `getBackendBaseUrl()` to check `process.env.NEXT_PUBLIC_BACKEND_ORIGIN`.

**Recommended regression test:**
Set `NEXT_PUBLIC_BACKEND_ORIGIN=http://api.staging.internal:8080` -> assert `getBackendBaseUrl()` returns that string.

---

### RT-UPLOAD-001 — Open Directory Listing on Static Uploads Directory

**Severity:** Medium  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Backend: Go 1.26 (`http.FileServer`)
- Route: `/uploads/*`

**Preconditions:**
Backend server running.

**Steps to reproduce:**
1. Execute `curl -s http://localhost:8080/uploads/`.
2. Execute `curl -s http://localhost:8080/uploads/avatars/`.

**Expected result:**
Directory indexes should be prohibited (`403 Forbidden` or `404 Not Found`). Only explicit file paths should be served.

**Actual result:**
Server returns HTML directory listing allowing enumeration of all subdirectories and uploaded filenames.

**Observed evidence:**
```html
<!doctype html>
<meta name="viewport" content="width=device-width">
<pre>
<a href="avatars/">avatars/</a>
<a href="comments/">comments/</a>
<a href="events/">events/</a>
<a href="groups/">groups/</a>
<a href="posts/">posts/</a>
</pre>
```

**Likely subsystem:**
`backend/internal/router/router.go:322` (`http.FileServer`).

**Requirement affected:**
Information Disclosure / Security.

**Recommended fix direction:**
Wrap `http.FileServer` with a filesystem handler that returns `os.ErrNotExist` when a directory path is requested.

**Recommended regression test:**
`curl -I http://localhost:8080/uploads/` -> assert status is 403 or 404.

---

### RT-AUTH-001 — Unauthenticated `GET /api/login` Returns 405 Method Not Allowed

**Severity:** Low  
**Confidence:** High  
**Runtime status:** Confirmed  

**Environment:**
- Backend: Go 1.26 `Auth.LoginHandler`

**Steps to reproduce:**
1. Send `GET /api/login` without session cookie.

**Expected result:**
Returns `401 Unauthorized` or `200 OK` with `authenticated: false`.

**Actual result:**
Returns `405 Method Not Allowed`.

**Observed evidence:**
```go
if r.Method == http.MethodGet {
    cookie, err := r.Cookie(h.cookieName)
    if err == nil { ... }
}
if r.Method != http.MethodPost {
    w.WriteHeader(http.StatusMethodNotAllowed)
    return
}
```

**Likely subsystem:**
`backend/internal/auth/handler.go:106`.

**Recommended fix direction:**
Explicitly return 401 when GET is received without a valid cookie.

---

### RT-POST-001 — Feed Endpoint Returns Bare Array Rather Than Wrapped Object

**Severity:** Info  
**Confidence:** High  
**Runtime status:** Confirmed  

**Summary:**
`GET /api/posts` returns a raw JSON array `[...]` rather than a standard envelope `{"posts": [...]}`. Documented to prevent client parsing errors.

---

### RT-GROUP-001 — Group Invitation Payload Parameter Mismatch

**Severity:** Info  
**Confidence:** High  
**Runtime status:** Confirmed  

**Summary:**
`POST /api/groups/{id}/invitations` requires `invited_user_id` instead of `user_id`. Passing `user_id` yields `400 Bad Request`.

---

### RT-GROUP-002 — Group Invitations Restricted to Creator Only

**Severity:** Info  
**Confidence:** High  
**Runtime status:** Confirmed  

**Summary:**
Standard members attempting to invite users receive `403 Only the group creator can invite people`.

---

### RT-CHAT-001 — Chat History Query Parameter Name

**Severity:** Info  
**Confidence:** High  
**Runtime status:** Confirmed  

**Summary:**
`GET /api/chat/history` expects `user_id`, not `contact_id` or `peer_id`.

---

### RT-UPLOAD-002 — Asymmetric WebP Format Policy

**Severity:** Info  
**Confidence:** High  
**Runtime status:** Confirmed  

**Summary:**
WebP format is supported for post and comment attachments, but explicitly blocked for user profile avatars.

