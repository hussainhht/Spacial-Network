# 11. Frontend/Backend Contract Integration Runtime Audit

## 1. Executive Domain Summary

The integration boundary between the Next.js frontend and the Go backend was examined through direct network traffic analysis, preflight CORS probes, payload shape comparisons, and header audits.

While both services compile without errors, significant runtime integration risks exist regarding **hardcoded hostnames**, **rigid CORS whitelisting**, and **asymmetric payload schemas**.

---

## 2. Origin, Hostname & CORS Audit

### 2.1 Hardcoded Localhost in Frontend (`frontend/src/lib/api.ts`)
```typescript
export function getBackendBaseUrl(): string {
  return `http://localhost:${BACKEND_PORT}`;
}

export function getWebSocketUrl(path: string = "/api/ws"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `ws://localhost:${BACKEND_PORT}${cleanPath}`;
}
```
**Runtime Impact:** The client completely ignores environment variables like `NEXT_PUBLIC_BACKEND_ORIGIN` or `NEXT_PUBLIC_BACKEND_WS_ORIGIN`. Any build accessed on a domain other than `localhost` fails to connect to the backend.

### 2.2 Static CORS Origin Whitelist (RT-CONTRACT-001)
In `backend/internal/middleware/cors.go`:
```go
w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
w.Header().Set("Access-Control-Allow-Credentials", "true")
```
**Runtime Verification:**
A preflight OPTIONS request sent with `Origin: http://192.168.100.24:3000` (the LAN IP emitted by Next.js) returned:
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: http://localhost:3000
```
Because `Access-Control-Allow-Credentials` is `true`, modern browsers reject any response where `Access-Control-Allow-Origin` does not match the request origin. Accessing the web application via `127.0.0.1:3000`, a LAN IP, or a Docker network container name triggers total CORS failure.

---

## 3. Request / Response Contract & Schema Inventory

| Endpoint | Method | Transport Content-Type | Payload Keys Expected by Backend | Return Payload Shape | Contract Notes & Potential Traps |
|---|:---:|---|---|---|---|
| `/api/register` | `POST` | `multipart/form-data` | `username`, `password`, `firstName`, `lastName`, `email`, `gender`, `dateOfBirth`, `profilePhoto` | `{"success": bool, "user_id": string, ...}` | Sending `application/json` fails with 400. Uses camelCase fields. |
| `/api/login` | `POST` | `application/json` | `username`, `password` | `{"message": string, "user_id": int, ...}` | `username` field accepts both handle or email. Unauthenticated `GET` returns 405. |
| `/api/posts` | `POST` | `multipart/form-data` | `title`, `content`, `visibility`, `viewer_ids`, `image` | Bare `PostResponse` object directly | Requires multipart. `viewer_ids` sent as repeated form keys. |
| `/api/posts` | `GET` | N/A | Query: `filter` (`all`, `following`, `friends`) | Bare JSON array `[...]` | **Asymmetric**: Returns a top-level array, unlike other endpoints which return `{data: [...]}`. |
| `/api/groups` | `POST` | `multipart/form-data` | `title`, `description`, `privacy`, `groupPhoto` | `{"success": true, "group_id": int64}` | Group ID is named `group_id` (not `id` or `groupId`). |
| `/api/groups` | `GET` | N/A | None | `{"groups": [...]}` | Wrapped in object. |
| `/api/groups/{id}/invitations` | `POST` | `application/json` | `invited_user_id` | `{"success": true, "message": string}` | Must be `invited_user_id`. Passing `user_id` fails with 400. |
| `/api/chat/history` | `GET` | N/A | Query: `user_id` | Array of message objects `[...]` | Must be `user_id`. Passing `contact_id` fails with 400. |
| `/api/users/me/avatar` | `PATCH` | `multipart/form-data` | `profilePhoto` | `{"success": true, "profile": {...}}` | Field name is `profilePhoto`. Passing `avatar` fails with 400. |

---

## 4. Rate Limiting Headers & Cost Accounting

On every HTTP request passing through `middleware.RateLimit`, the server injects two-tier token bucket telemetry:
```http
X-Ratelimit-Limit-Global: 30
X-Ratelimit-Remaining-Global: 26
X-Ratelimit-Limit-Endpoint: 10
X-Ratelimit-Remaining-Endpoint: 6
```
- Feed read sub-queries (`GET /posts/{id}/likes`, `GET /posts/{id}/comments/count`) deduct only `0.2` tokens.
- Mutation routes (`POST`, `PUT`, `DELETE`, `PATCH`) deduct `1.0` tokens.
- Global capacity resets over time (refill rate: 10 tokens/s).

---

## 5. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-CONTRACT-001** | **High** | Backend CORS origin is hardcoded to `http://localhost:3000` | Any access through alternate hostnames (e.g. `127.0.0.1`, LAN IP `192.168.x.x`, or Docker container hostnames) is blocked by browser CORS security due to origin mismatch with credentials enabled. |
| **RT-CONTRACT-002** | **Medium** | Frontend API client hardcodes `http://localhost:8080` | `getBackendBaseUrl()` and `getWebSocketUrl()` ignore configuration variables, breaking containerized or deployed topologies where the backend is not on `localhost:8080`. |

