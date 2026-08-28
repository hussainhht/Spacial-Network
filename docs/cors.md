# CORS (Cross-Origin Resource Sharing)

This document explains what CORS is, why this project needs it, and how it is
implemented in the Go backend.

## What Is CORS

Browsers enforce the **same-origin policy**: a web page loaded from one origin
(scheme + host + port) cannot read the response of a request it makes to a
different origin, unless that other origin explicitly allows it.

CORS is the mechanism a server uses to grant that permission. The server adds
`Access-Control-*` response headers telling the browser "this origin, these
methods, and these headers are allowed to talk to me." The browser reads those
headers and decides whether to let the calling page's JavaScript access the
response.

## Why This Project Needs It

The frontend and backend run as two separate origins:

| Service  | Origin                  |
| -------- | ------------------------ |
| Frontend | `http://localhost:3000` |
| Backend  | `http://localhost:<api-port>` (a different port) |

Without CORS headers, a `fetch`/`axios` call from the Next.js frontend to the
Go API would be blocked by the browser, even though the request itself
succeeds on the server. This project also uses cookie-based sessions
(`social/pkg/session`), so the browser must additionally be told that
credentials (cookies) are allowed to be sent and read across origins —
otherwise the session cookie set by `/api/login` would never be attached to
later requests like `/api/logout`.

## How It Is Implemented

The CORS logic lives in [`backend/internal/middleware/cors.go`](../backend/internal/middleware/cors.go)
as a standard `net/http` middleware:

```go
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

Each header serves a specific purpose:

- **`Access-Control-Allow-Origin: http://localhost:3000`** — only the Next.js
  dev server is allowed to read responses from the API. It is a fixed value
  rather than `*` because `*` is not permitted by browsers when credentials
  are involved.
- **`Access-Control-Allow-Credentials: true`** — allows the browser to send
  the session cookie with cross-origin requests and to expose the response to
  the page's JavaScript when the request was made with credentials
  (`fetch(url, { credentials: "include" })`).
- **`Access-Control-Allow-Methods`** — whitelists the HTTP verbs the API
  accepts, matching what the router registers (`GET, POST, PUT, PATCH,
  DELETE`) plus `OPTIONS` for preflight itself.
- **`Access-Control-Allow-Headers: Content-Type, Authorization`** — whitelists
  the request headers the frontend is allowed to set, since browsers restrict
  custom headers on cross-origin requests unless the server explicitly allows
  them.
- **Preflight short-circuit** — browsers send an `OPTIONS` request before
  certain "non-simple" requests (e.g. anything with `Content-Type:
  application/json`) to check whether the real request would be allowed. The
  middleware answers this preflight immediately with `204 No Content` and
  returns, without forwarding it to the rest of the application.

### Where It's Applied

`CORS` wraps the whole API mux in [`backend/internal/router/router.go`](../backend/internal/router/router.go):

```go
handler := middleware.CORS(apiMux)

mux := http.NewServeMux()
mux.Handle("/api/", http.StripPrefix("/api", handler))
```

```text
Browser (http://localhost:3000)
   |
   | fetch("/api/login", { credentials: "include" })
   v
Go server: /api/ 
   |
   v
middleware.CORS
   |
   +--> OPTIONS (preflight) --> 204 No Content (headers only, request stops here)
   |
   +--> GET/POST/... --> headers attached --> apiMux --> route handler
```

Because `CORS` wraps `apiMux` before it is registered under `/api/`, every API
route (public and session-protected) gets the same CORS headers. Requests
under `/uploads/` are served directly by `http.FileServer` and are **not**
wrapped by this middleware, since browsers do not apply CORS checks to
resources loaded as `<img src="...">`.

## Current Limitation

The allowed origin is hardcoded to `http://localhost:3000`. This works for
local development but must be made configurable (e.g. read from
`config.Config`) before deploying to a different frontend URL — otherwise the
production frontend's requests will be blocked in the same way an
unconfigured cross-origin request is blocked today.
