# 02. Authentication & Session Runtime & E2E Audit

## 1. Executive Domain Summary

The authentication and session subsystem was audited through direct HTTP requests, multipart form submissions, and automated browser sessions with Playwright.

Overall authentication functionality is robust, utilizing bcrypt (cost 10) password hashing and cryptographically secure random session tokens stored in SQLite with sliding expiration. However, several critical runtime quirks and architectural constraints were identified, including **single-session-per-user enforcement** (logging in on a second device or tab immediately invalidates the first), a **WebSocket reconnection loop on unauthenticated pages**, and a strict requirement for **`multipart/form-data` on the registration API**.

---

## 2. Registration API & Form E2E

### 2.1 Direct API Contract & Payload Requirements
The registration endpoint (`POST /api/register`) processes requests via `r.ParseMultipartForm(8 MiB)`.
- **Content-Type:** Must be `multipart/form-data`. Submitting `application/json` or `application/x-www-form-urlencoded` results in immediate `400 Bad Request` with `{"success":false,"message":"Invalid request payload or body"}`.
- **Field Naming Convention:** Uses camelCase (`firstName`, `lastName`, `dateOfBirth`, `aboutMe`, `profilePhoto`).
- **Username Length Limit:** The backend enforces a 20-character maximum (`users.ValidateUsername`). Usernames exceeding 20 characters return `400 Bad Request` (`username must be at most 20 characters`).

### 2.2 Registration Validation Test Results

| Test Case | Request Payload / Scenario | HTTP Status | Response Payload | Verdict |
|---|---|:---:|---|:---:|
| Empty Payload | `{}` | `400 Bad Request` | `{"success":false,"message":"Invalid request payload or body"}` | **PASS** |
| Missing Password | Valid fields except `password` | `400 Bad Request` | `{"success":false,"message":"password cannot be empty"}` | **PASS** |
| Missing Required Names | Missing `firstName` or `lastName` | `400 Bad Request` | `{"success":false,"message":"first name cannot be empty"}` | **PASS** |
| Invalid Email Syntax | `email: "not-an-email"` | `400 Bad Request` | `{"success":false,"message":"invalid email format"}` | **PASS** |
| Valid Registration (No Avatar) | Valid details, 18+ age, under 20 char username | `201 Created` | `{"success":true,"message":"User registered successfully","user_id":"<uuid>"}` | **PASS** |
| Duplicate Username | Re-submit existing username with different email | `409 Conflict` | `{"success":false,"message":"Username already exists"}` | **PASS** |
| Duplicate Email | Re-submit existing email with different username | `409 Conflict` | `{"success":false,"message":"Email already exists"}` | **PASS** |
| Session Issuance | Inspect response headers after successful register | `201 Created` | `Set-Cookie` is **NOT** issued | **CONFIRMED** |

> **Observation:** Successful registration intentionally does not auto-login the user or issue a session cookie. The user must proceed to `/login`.

---

## 3. Login API & Credential Verification

### 3.1 Contract & Validation
- **Route:** `POST /api/login`
- **Content-Type:** `application/json`
- **Fields:** `{"username": "<username or email>", "password": "<password>"}` (Note: The `username` field accepts both handle and email address).

### 3.2 Login Test Results

| Test Case | Input | HTTP Status | Response Shape | Cookie Issued | Verdict |
|---|---|:---:|---|:---:|:---:|
| Valid Login (Username) | `username: "alice"`, `password: "Password123!"` | `200 OK` | `{"message":"Login successful","user_id":1,...}` | `session_token` (24h) | **PASS** |
| Valid Login (Email) | `username: "alice@space.net"`, `password: "Password123!"` | `200 OK` | `{"message":"Login successful","user_id":1,...}` | `session_token` (24h) | **PASS** |
| Wrong Password | `username: "alice"`, `password: "WrongPass!"` | `401 Unauthorized` | `{"error":"Invalid username/email or password"}` | None | **PASS** |
| Unknown User | `username: "nonexistent"`, `password: "Password123!"` | `401 Unauthorized` | `{"error":"Invalid username/email or password"}` | None | **PASS** |
| Username Too Long | `username: ">20 chars handle"`, `password: "..."` | `400 Bad Request` | `{"error":"username must be at most 20 characters"}` | None | **PASS** |
| Empty Credentials | `{}` | `400 Bad Request` | `{"error":"invalid login payload"}` | None | **PASS** |

---

## 4. Session & Cookie Lifecycle

### 4.1 Cookie Attributes Verified
Upon successful login, the backend emits the following `Set-Cookie` header:
```http
Set-Cookie: session_token=<64-hex-token>; Path=/; Expires=<now + 24h>; HttpOnly; SameSite=Lax
```
- **Name:** `session_token`
- **HttpOnly:** `true` (XSS cannot steal the token via `document.cookie`)
- **SameSite:** `Lax` (Prevents CSRF on cross-site POST while allowing top-level navigation)
- **Secure:** `false` (Appropriate for HTTP local development)
- **Path:** `/`

### 4.2 Single Session Per User Constraint (Architectural Defect / RT-SESSION-001)
In `backend/internal/auth/repository.go`:
```go
const checkQuery = `SELECT 1 FROM sessions WHERE user_id = ? LIMIT 1`
...
if err == nil {
    const updateQuery = `
        UPDATE sessions
        SET session_token = ?, created_at = ?, expires_at = ?, revoked_at = NULL
        WHERE user_id = ?
    `
    _, err = r.db.Exec(updateQuery, token, now, expiresAt, userID)
}
```
**Runtime Impact:**
When User Alice logs in on Device A / Session 1, a token is stored. If Alice logs in on Device B / Session 2, the `sessions` record for `user_id = 1` is updated in-place with the new token.
Immediately upon the next request from Device A:
```http
HTTP/1.1 401 Unauthorized
Content-Type: text/plain; charset=utf-8
Unauthorized: invalid session
```
Device A's session is violently revoked without explicit logout. Multi-device usage or opening a second browser context causes the prior context to get logged out immediately.

### 4.3 Logout E2E Flow
1. Client sends `POST /api/logout` with active `session_token`.
2. Backend revokes session in SQLite:
   ```sql
   UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_token = ?
   ```
3. Backend emits deletion cookie:
   ```http
   Set-Cookie: session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax
   ```
4. Subsequent requests with the old token receive: `401 Unauthorized: invalid session`.
5. Subsequent requests without a cookie receive: `401 Unauthorized: Cookie Not Found`.

### 4.4 `GET /api/login` Dual Behavior
- **Authenticated:** Returns `200 OK` with `{"message":"Already logged in", "user_id": 1, ...}`.
- **Unauthenticated:** Returns `405 Method Not Allowed`. (The handler checks `r.Method == GET` only if a valid cookie is present; otherwise, execution falls through to `r.Method != POST` which issues 405).

---

## 5. Browser Automation (Playwright E2E)

A full end-to-end browser test was executed against `http://localhost:3000/login`:
1. **Navigation:** Browser loaded `/login` with 3D space backdrop.
2. **Form Interaction:** Filled username `alice` and password, clicked `Sign In`.
3. **Redirection:** Frontend successfully redirected to `http://localhost:3000/` within 600ms.
4. **Cookie Storage:** Headless Chromium confirmed receipt of `session_token` with `HttpOnly: true` and `SameSite: Lax`.
5. **Page Reload:** Browser refreshed `http://localhost:3000/`. Session persisted, user feed rendered, and authenticated UI elements (Alice Walker profile badge) appeared.

---

## 6. Discovered Runtime Issues in Auth / Session

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-SESSION-001** | **High** | Single concurrent session limit per user account | `CreateSession` updates `sessions` table where `user_id = ?`, terminating any active session on other devices/tabs upon new login. |
| **RT-WS-002** | **Medium** | Unauthenticated WebSocket connection loop | `WebSocketProvider` in `RootLayout` attempts connection to `/api/ws` every 1500ms even when unauthenticated, polluting console with 401 errors. |
| **RT-AUTH-001** | **Low** | Unauthenticated `GET /api/login` returns 405 instead of 401 | Falling through `r.Method != POST` check returns 405 Method Not Allowed rather than 401 Unauthorized when no cookie is supplied. |

