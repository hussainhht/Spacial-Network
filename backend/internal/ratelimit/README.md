# ratelimit

Per-user, two-tier token-bucket rate limiting, split into a service and an
HTTP layer the same way the rest of this codebase separates the two:

- **`internal/ratelimit`** (this package) is the service: `Bucket` and
  `Limiter` own all the bucket/timeout state and decide each request via
  `Limiter.Check`. It has no knowledge of `net/http` beyond taking a
  `*http.Request` where a caller-supplied `RequestCost` needs one - it's
  the same shape as `auth.Service` or `notifications.Service`.
- **`internal/middleware`** (`ratelimit.go` there) is the HTTP layer:
  `middleware.RateLimit(limiter, identity, endpoint)` extracts identity and
  endpoint from the request, calls `Limiter.Check`, and writes the 429 or
  the success headers - the same shape as `middleware.SessionMiddleware`,
  which takes an `*auth.Service` and returns composable middleware.

Every request must pass **two** independent buckets:

1. **Global (hard cap)** - one bucket per user, shared across all endpoints.
2. **Endpoint (soft cap)** - one bucket per `(user, endpoint)` pair.

Whichever bucket empties first puts the caller in a timeout: further
requests (global-wide, or just to that endpoint) are rejected immediately
with `429` for the timeout's duration, without touching the bucket math at
all. This means a user who trips a limit and stops sending requests will
still be blocked for the full penalty once they resume, even though their
bucket would otherwise have refilled by then - the timeout is a deliberate
"back off" penalty, not just a reflection of current bucket state.

## Wiring it in

This is wired into every route already, not just documented as an example.
`internal/router/dependencies.go` builds one shared `*ratelimit.Limiter`
from `config.Config`'s `RateLimit*` fields, alongside the other shared
services (`AuthService`, etc.):

```go
// internal/router/dependencies.go
rateLimiter := ratelimit.NewLimiter(ratelimit.LimiterConfig{
    GlobalCapacity:     cfg.RateLimitGlobalCapacity,
    GlobalRefillRate:   cfg.RateLimitGlobalRefillRate,
    GlobalPenalty:      cfg.RateLimitGlobalPenalty,
    EndpointCapacity:   cfg.RateLimitEndpointCapacity,
    EndpointRefillRate: cfg.RateLimitEndpointRefillRate,
    EndpointPenalty:    cfg.RateLimitEndpointPenalty,
})
// ... returned on Dependencies as RateLimiter
```

`internal/router/router.go` then builds the middleware from that service
and applies it per route, the same way `sessionMiddleware` already is:

```go
rateLimit := middleware.RateLimit(deps.RateLimiter, nil, nil) // nil, nil = use the defaults below

apiMux.Handle("/login", rateLimit(http.HandlerFunc(deps.Handlers.Auth.LoginHandler)))

apiMux.Handle(
    "POST /posts",
    sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.NewPostHandler))),
)
```

Every protected route is wrapped as `sessionMiddleware(rateLimit(handler))`
- rate limiting **inside** the session check, not outside/around the whole
mux. This matters for two reasons:

- Identity: `middleware.DefaultRateLimitIdentity` reads the user ID that
  `SessionMiddleware` puts on the request context via
  `internal/requestctx`. Nesting it inside means an authenticated request's
  bucket key is the actual user ID, not their IP.
- Endpoint grouping: `middleware.DefaultRateLimitEndpoint` reads
  `r.Pattern`, which `net/http.ServeMux` only populates *after* it has
  matched and dispatched to a registered handler. Wrapping the whole mux
  (the way `middleware.CORS` does) runs before that match happens, so
  `r.Pattern` would still be empty there.

The two public routes that run before any session exists
(`/login`, `/register`) get `rateLimit` applied directly, with no
`sessionMiddleware` around it - `DefaultRateLimitIdentity` falls back to IP
there, which is the one place in this app where that fallback is expected
to actually trigger.

**Known gap from this ordering:** because `rateLimit` sits *inside*
`sessionMiddleware` on protected routes, a request with no cookie or an
invalid/expired one is rejected by `sessionMiddleware` (401) before ever
reaching the limiter - so repeated invalid-session requests against
protected routes (each of which still costs a `ValidateSession` DB lookup
if a cookie is present) aren't throttled by this middleware. Per-user
throttling of authenticated traffic was the ask here; guarding the session
check itself against brute-forcing would need a separate, IP-keyed limiter
placed *outside* `sessionMiddleware` - not added, to avoid conflating two
different concerns in one limiter.

## Tuning capacity / refill / penalty

Each tier is an independent token bucket: `capacity` is the burst size,
`refillRate` is the sustained rate in tokens/sec. To "sustain N req/s, burst
up to capacity":

- Set `refillRate = N`.
- Set `capacity` to however many requests you want to allow to land back-to-back
  before throttling kicks in (capacity `== refillRate` means no burst
  headroom beyond the steady rate).
- `penalty` is how long a user sits in timeout once that tier empties.
  Longer penalties punish sustained abuse harder; shorter penalties recover
  faster from incidental bursts (e.g. a page load firing several requests
  at once).

Rule of thumb: make the **global** cap generous (it's the last line of
defense across the whole API) and use **endpoint** caps to protect specific
expensive routes (uploads, search, post creation) with tighter limits.

`RequestCost` lets specific requests cost more than 1 token against both
tiers - e.g. weighting a media upload endpoint's cost by file size, or a
search endpoint's cost by result count:

```go
GlobalRefillRate: 5,
RequestCost: func(r *http.Request) float64 {
    if r.Pattern == "POST /groups/{id}/posts" {
        return 2 // group posts fan out to every member; count them double
    }
    return 1
},
```

## Assumptions made

The project has no existing rate limiting, so several defaults were chosen
and should be revisited against real traffic before shipping:

- **Identity fallback to IP.** The project's only existing per-request
  identity is the session-authenticated user ID
  (`internal/requestctx.UserID`, set by `middleware.SessionMiddleware`).
  Every protected route in `router.go` is wrapped in that middleware, so
  the IP fallback in `middleware.DefaultRateLimitIdentity` only actually
  triggers on the two public routes (`/login`, `/register`) that run
  before any session exists. It's documented in code as weaker than session identity (shared
  NAT/proxy IPs collide; IPs are easy to rotate). `r.RemoteAddr` is used
  directly - this project has no reverse proxy in front of it today, so
  `X-Forwarded-For` is intentionally *not* trusted; if one is added later,
  that header must come from a trusted proxy hop only, or it becomes a
  trivial way to spoof identity and dodge the limiter entirely.
- **Endpoint identity uses `r.Pattern`** (the matched `ServeMux` pattern,
  e.g. `"POST /posts/{id}"`) rather than the raw URL path, so that
  `/posts/1`, `/posts/2`, etc. share one soft-cap bucket instead of getting
  one each. This requires Go's enhanced `ServeMux` pattern matching
  (method + wildcards), which this module already relies on throughout
  `router.go`.
- **No shared JSON error envelope exists in this codebase** - every package
  (`posts`, `comments`, `notifications`, `auth`, ...) defines its own local
  `Response{Message, Error}` struct and does
  `w.WriteHeader(status); json.NewEncoder(w).Encode(Response{Error: "..."})`.
  `ratelimit`'s 429 body follows that same shape (`{"error": "...", ...}`)
  rather than inventing a new envelope, with two extra fields (`limit`,
  `retry_after_seconds`) since no existing error body carries rate-limit
  specifics.
- **No existing structured logger or metrics client** - the codebase logs
  ad hoc via the standard `log` package. `ratelimit` doesn't log on its own
  to avoid disagreeing with that; a caller can observe rejections via the
  `Decision` returned by `Limiter.Check` or by wrapping the middleware if
  they want request logs.
- **Not refunding the global bucket on a soft-cap rejection** (step 4 vs 5
  in the request flow): if the global bucket succeeds but the endpoint
  bucket then rejects, the global charge stands. The request did consume
  global capacity by being attempted, and refunding it would let a caller
  probe an exhausted endpoint for free against the global cap.
- **No external dependencies.** Everything is standard library
  (`net/http`, `sync`, `time`, `encoding/json`). This matches `go.mod`,
  which has no router/framework dependency to speak of (stdlib
  `net/http` + `ServeMux` throughout) and no metrics/logging library either.
- **Config values live in `config.Config`**, following the existing
  `Load()`-with-hardcoded-defaults pattern (there's no env-var override
  mechanism for most settings today, e.g. `SessionLifetime`, so
  `RateLimit*` doesn't add one either). The shipped defaults (30 cap / 10
  req/s / 30s penalty global, 10 cap / 3 req/s / 15s penalty per endpoint)
  are a starting point, not a measured target - tune them against real
  traffic.

## Memory management

A background goroutine (started by `NewLimiter`, stopped by `Limiter.Close`)
sweeps all four maps on `LimiterConfig.CleanupInterval` (default 2m):

- Buckets that are both **full** (at capacity, refill-projected forward to
  the sweep time) and **idle** for at least `LimiterConfig.IdleThreshold`
  (default 10m) are evicted. A bucket sitting below capacity is left alone
  even if idle - its owner may return before it refills, and dropping it
  would silently reset their consumed capacity.
- Expired timeout entries (`penalizedUntil` in the past) are dropped too,
  so a user who trips a limit once and never returns doesn't leave a
  permanent entry behind.

## Package layout

- `bucket.go` - the `Bucket` type: lazy refill, `Consume`, idle-eviction check.
- `limiter.go` - `Limiter`, `LimiterConfig`, the four per-key maps, the cleanup loop, `Cost`/`Len` (accessors for the HTTP layer and for tests/metrics).
- `internal/middleware/ratelimit.go` (separate package) - HTTP wiring: `RateLimit`, identity/endpoint extraction, response writing. See that file's doc comments for the middleware-side API.

Tests follow this project's black-box, `_test`-package convention and are
split the same way as the code:

- `tests/bucket/` (`bucket_test.go`, `limiter_test.go`) - the `ratelimit`
  service, through its exported API only.
- `tests/middleware/ratelimit_test.go` - `middleware.RateLimit`, via
  `httptest`.

Run both with `go test -race ./tests/bucket/... ./tests/middleware/...`.
