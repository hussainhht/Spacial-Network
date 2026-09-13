// Package middleware_test exercises social/internal/middleware.RateLimit -
// the HTTP layer wired to the social/internal/ratelimit service - as a
// black box, through its exported API only.
package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"social/internal/middleware"
	"social/internal/ratelimit"
)

// errorBody mirrors the JSON shape RateLimit writes on a 429 (see
// internal/middleware/ratelimit.go's rateLimitErrorResponse, which is
// unexported - this is the black-box equivalent for decoding in tests).
type errorBody struct {
	Error      string  `json:"error"`
	Limit      string  `json:"limit"`
	RetryAfter float64 `json:"retry_after_seconds"`
}

// testIdentity reads a stand-in identity header instead of a real session
// cookie, so these tests exercise the middleware in isolation from the
// rest of the app's auth stack.
func testIdentity(r *http.Request) string {
	return r.Header.Get("X-Test-User")
}

func newTestServer(t *testing.T, cfg ratelimit.LimiterConfig) *http.ServeMux {
	t.Helper()
	l := ratelimit.NewLimiter(cfg)
	t.Cleanup(l.Close)

	rl := middleware.RateLimit(l, testIdentity, nil)
	mux := http.NewServeMux()
	ok := func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }
	mux.Handle("GET /a", rl(http.HandlerFunc(ok)))
	mux.Handle("GET /b", rl(http.HandlerFunc(ok)))

	return mux
}

func doRequest(mux *http.ServeMux, user, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Test-User", user)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestMiddlewareBurstTriggers429WithAccurateRetryAfter(t *testing.T) {
	mux := newTestServer(t, ratelimit.LimiterConfig{
		GlobalCapacity:     3,
		GlobalRefillRate:   0,
		GlobalPenalty:      2 * time.Second,
		EndpointCapacity:   1000,
		EndpointRefillRate: 1000,
		EndpointPenalty:    time.Second,
	})

	for i := 0; i < 3; i++ {
		rec := doRequest(mux, "alice", "/a")
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: status = %d, want 200", i, rec.Code)
		}
	}

	rec := doRequest(mux, "alice", "/a")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("4th request: status = %d, want 429", rec.Code)
	}

	retryAfter, err := strconv.Atoi(rec.Header().Get("Retry-After"))
	if err != nil {
		t.Fatalf("Retry-After header = %q, not an integer: %v", rec.Header().Get("Retry-After"), err)
	}
	if retryAfter < 1 || retryAfter > 2 {
		t.Fatalf("Retry-After = %d, want ~2 (the GlobalPenalty)", retryAfter)
	}

	var body errorBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Limit != "global" {
		t.Fatalf("body.Limit = %q, want %q", body.Limit, "global")
	}
	if body.Error == "" {
		t.Fatal("expected a non-empty error message")
	}
}

func TestMiddlewareDifferentUsersDoNotInterfere(t *testing.T) {
	mux := newTestServer(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1,
		GlobalRefillRate:   0,
		GlobalPenalty:      time.Minute,
		EndpointCapacity:   1000,
		EndpointRefillRate: 1000,
		EndpointPenalty:    time.Second,
	})

	if rec := doRequest(mux, "alice", "/a"); rec.Code != http.StatusOK {
		t.Fatalf("alice's first request: status = %d, want 200", rec.Code)
	}
	if rec := doRequest(mux, "alice", "/a"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("alice's second request should exhaust her global cap, status = %d", rec.Code)
	}

	// Bob has his own global bucket and must be unaffected by alice's cap.
	if rec := doRequest(mux, "bob", "/a"); rec.Code != http.StatusOK {
		t.Fatalf("bob's request: status = %d, want 200 (must not be affected by alice)", rec.Code)
	}
}

func TestMiddlewareDifferentEndpointsHaveIndependentSoftCaps(t *testing.T) {
	mux := newTestServer(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1000,
		GlobalRefillRate:   1000,
		GlobalPenalty:      time.Second,
		EndpointCapacity:   1,
		EndpointRefillRate: 0,
		EndpointPenalty:    time.Minute,
	})

	if rec := doRequest(mux, "alice", "/a"); rec.Code != http.StatusOK {
		t.Fatalf("alice's first hit on /a: status = %d, want 200", rec.Code)
	}
	if rec := doRequest(mux, "alice", "/a"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("alice's second hit on /a should trip the soft cap, status = %d", rec.Code)
	}

	// /b has its own bucket for the same user.
	if rec := doRequest(mux, "alice", "/b"); rec.Code != http.StatusOK {
		t.Fatalf("alice's hit on /b: status = %d, want 200 (independent soft cap from /a)", rec.Code)
	}
}

func TestMiddlewareSuccessHeaders(t *testing.T) {
	mux := newTestServer(t, ratelimit.LimiterConfig{
		GlobalCapacity:     5,
		GlobalRefillRate:   1,
		GlobalPenalty:      time.Minute,
		EndpointCapacity:   3,
		EndpointRefillRate: 1,
		EndpointPenalty:    time.Minute,
	})

	rec := doRequest(mux, "alice", "/a")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("X-RateLimit-Limit-Global"); got != "5" {
		t.Fatalf("X-RateLimit-Limit-Global = %q, want %q", got, "5")
	}
	if got := rec.Header().Get("X-RateLimit-Remaining-Global"); got != "4" {
		t.Fatalf("X-RateLimit-Remaining-Global = %q, want %q", got, "4")
	}
	if got := rec.Header().Get("X-RateLimit-Limit-Endpoint"); got != "3" {
		t.Fatalf("X-RateLimit-Limit-Endpoint = %q, want %q", got, "3")
	}
	if got := rec.Header().Get("X-RateLimit-Remaining-Endpoint"); got != "2" {
		t.Fatalf("X-RateLimit-Remaining-Endpoint = %q, want %q", got, "2")
	}
}
