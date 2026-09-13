package middleware

import (
	"encoding/json"
	"math"
	"net"
	"net/http"
	"strconv"

	"social/internal/ratelimit"
	"social/internal/requestctx"
)

// RateLimitIdentityFunc extracts a stable identity string from a request.
type RateLimitIdentityFunc func(r *http.Request) string

// RateLimitEndpointFunc extracts the logical endpoint a request targets,
// used as the soft-cap grouping key.
type RateLimitEndpointFunc func(r *http.Request) string

// DefaultRateLimitIdentity uses the session-authenticated user set on the
// request context by SessionMiddleware (via social/internal/requestctx).
// If a request reaches this middleware without that context value - e.g.
// it's mounted ahead of SessionMiddleware, or on a public route - it falls
// back to the client's remote IP.
//
// IP-based identity is weaker than the session identity: it lumps every
// user behind the same NAT/proxy IP into one bucket, and is easy to evade
// by rotating source addresses. Only rely on it for endpoints that
// intentionally have no authenticated identity to key on.
func DefaultRateLimitIdentity(r *http.Request) string {
	if userID, ok := requestctx.UserID(r.Context()); ok {
		return "user:" + strconv.Itoa(userID)
	}
	return "ip:" + clientIP(r)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// DefaultRateLimitEndpoint uses r.Pattern, the net/http ServeMux pattern
// that matched the request (e.g. "POST /posts/{id}"), so path parameters
// don't fragment the soft cap into one bucket per resource. r.Pattern is
// only populated once the mux has matched and dispatched the request, so
// this only works when RateLimit wraps an individual registered handler
// (as SessionMiddleware is wired in this project) rather than the whole
// mux. It falls back to "METHOD /raw/path" otherwise.
func DefaultRateLimitEndpoint(r *http.Request) string {
	if r.Pattern != "" {
		return r.Pattern
	}
	return r.Method + " " + r.URL.Path
}

// rateLimitErrorResponse mirrors this codebase's local per-package
// Response{Error} convention (see e.g. internal/posts.Response) so
// rate-limit rejections look like every other JSON error body in the API.
type rateLimitErrorResponse struct {
	Error      string  `json:"error"`
	Limit      string  `json:"limit"`
	RetryAfter float64 `json:"retry_after_seconds"`
}

// RateLimit returns stdlib http.Handler middleware backed by a
// social/internal/ratelimit.Limiter - the service that owns the actual
// bucket/timeout state and decides each request via Limiter.Check.
// identity and endpoint may be nil to use
// DefaultRateLimitIdentity/DefaultRateLimitEndpoint. It composes the same
// way as SessionMiddleware:
//
//	rl := ratelimit.NewLimiter(cfg)
//	rateLimit := middleware.RateLimit(rl, nil, nil)
//	apiMux.Handle("POST /posts", sessionMiddleware(rateLimit(http.HandlerFunc(h.NewPostHandler))))
func RateLimit(limiter *ratelimit.Limiter, identity RateLimitIdentityFunc, endpoint RateLimitEndpointFunc) func(http.Handler) http.Handler {
	if identity == nil {
		identity = DefaultRateLimitIdentity
	}
	if endpoint == nil {
		endpoint = DefaultRateLimitEndpoint
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := identity(r)
			ep := endpoint(r)
			cost := limiter.Cost(r)

			decision := limiter.Check(userID, ep, cost)
			if !decision.Allowed {
				writeRateLimited(w, decision)
				return
			}

			writeRateLimitHeaders(w, decision)
			next.ServeHTTP(w, r)
		})
	}
}

func writeRateLimited(w http.ResponseWriter, d ratelimit.Decision) {
	retrySeconds := int(math.Ceil(d.RetryAfter.Seconds()))
	if retrySeconds < 0 {
		retrySeconds = 0
	}
	w.Header().Set("Retry-After", strconv.Itoa(retrySeconds))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)

	msg := "endpoint rate limit exceeded"
	if d.Limited == "global" {
		msg = "global rate limit exceeded"
	}
	json.NewEncoder(w).Encode(rateLimitErrorResponse{
		Error:      msg,
		Limit:      d.Limited,
		RetryAfter: d.RetryAfter.Seconds(),
	})
}

func writeRateLimitHeaders(w http.ResponseWriter, d ratelimit.Decision) {
	h := w.Header()
	h.Set("X-RateLimit-Limit-Global", formatFloat(d.GlobalLimit))
	h.Set("X-RateLimit-Remaining-Global", formatFloat(math.Floor(d.GlobalRemaining)))
	h.Set("X-RateLimit-Limit-Endpoint", formatFloat(d.EndpointLimit))
	h.Set("X-RateLimit-Remaining-Endpoint", formatFloat(math.Floor(d.EndpointRemaining)))
}

func formatFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}
