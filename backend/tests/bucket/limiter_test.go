package ratelimit_test

import (
	"testing"
	"time"

	"social/internal/ratelimit"
)

func newTestLimiter(t *testing.T, cfg ratelimit.LimiterConfig) *ratelimit.Limiter {
	t.Helper()
	l := ratelimit.NewLimiter(cfg)
	t.Cleanup(l.Close)
	return l
}

func TestLimiterHardCapTripsBeforeSoftCap(t *testing.T) {
	// Global capacity is 1 and refills fast; endpoint capacity is bigger
	// and never refills. The first request drains global (succeeds) and
	// consumes one endpoint token; the second is denied by the (now empty)
	// global bucket before the endpoint bucket is ever consulted. Once the
	// short global penalty expires and the fast refill catches global back
	// up, a third request must still succeed against the endpoint bucket -
	// which it only can if the earlier global-denied request never touched
	// it (endpoint never refills, so a phantom double-consume there would
	// exhaust it and this would fail).
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1,
		GlobalRefillRate:   1000, // refills fully in ~1ms
		GlobalPenalty:      20 * time.Millisecond,
		EndpointCapacity:   2,
		EndpointRefillRate: 0,
		EndpointPenalty:    time.Minute,
	})

	if d := l.Check("alice", "GET /posts", 1); !d.Allowed {
		t.Fatalf("first request should be allowed, got denied by %q", d.Limited)
	}

	d := l.Check("alice", "GET /posts", 1)
	if d.Allowed || d.Limited != "global" {
		t.Fatalf("second request should be denied by the global cap, got %+v", d)
	}

	time.Sleep(50 * time.Millisecond) // past the 20ms global penalty

	if d := l.Check("alice", "GET /posts", 1); !d.Allowed {
		t.Fatalf("third request should succeed against the still-fresh endpoint bucket, got denied by %q (endpoint bucket was likely touched by the rejected second request)", d.Limited)
	}
}

func TestLimiterSoftCapIsPerUserPerEndpoint(t *testing.T) {
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1000,
		GlobalRefillRate:   0,
		GlobalPenalty:      time.Minute,
		EndpointCapacity:   1,
		EndpointRefillRate: 0,
		EndpointPenalty:    time.Minute,
	})

	if d := l.Check("alice", "POST /posts", 1); !d.Allowed {
		t.Fatalf("alice's first hit on POST /posts should be allowed, got denied by %q", d.Limited)
	}

	// Same user, same endpoint again: soft cap should now trip.
	d := l.Check("alice", "POST /posts", 1)
	if d.Allowed || d.Limited != "endpoint" {
		t.Fatalf("Check() = %+v, want denied by endpoint cap", d)
	}

	// Same user, different endpoint: independent bucket, must still work.
	if d := l.Check("alice", "GET /profiles/alice", 1); !d.Allowed {
		t.Fatalf("a different endpoint for the same user should be unaffected, got denied by %q", d.Limited)
	}

	// Different user, same endpoint that alice exhausted: independent bucket.
	if d := l.Check("bob", "POST /posts", 1); !d.Allowed {
		t.Fatalf("a different user on the same endpoint should be unaffected, got denied by %q", d.Limited)
	}
}

func TestLimiterTimeoutOutlastsRefill(t *testing.T) {
	// Fast refill, but a much longer penalty: once the timeout trips,
	// requests must stay blocked even after the bucket math alone would
	// have allowed them again.
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1,
		GlobalRefillRate:   1000, // refills fully in ~1ms
		GlobalPenalty:      150 * time.Millisecond,
		EndpointCapacity:   1000,
		EndpointRefillRate: 1000,
		EndpointPenalty:    time.Millisecond,
	})

	if d := l.Check("alice", "GET /posts", 1); !d.Allowed {
		t.Fatalf("first request should be allowed, got denied by %q", d.Limited)
	}
	d := l.Check("alice", "GET /posts", 1)
	if d.Allowed || d.Limited != "global" {
		t.Fatalf("second request should trip the global cap and start a timeout, got %+v", d)
	}

	// Give the bucket plenty of time to refill on its own - if the penalty
	// weren't independent of bucket state, this request would now succeed.
	time.Sleep(20 * time.Millisecond)
	if d := l.Check("alice", "GET /posts", 1); d.Allowed {
		t.Fatal("request during an active timeout must be denied even though the bucket has refilled")
	}

	// After the timeout itself expires, requests succeed again.
	time.Sleep(150 * time.Millisecond)
	if d := l.Check("alice", "GET /posts", 1); !d.Allowed {
		t.Fatalf("request after timeout expiry should be allowed, got denied by %q", d.Limited)
	}
}

func TestLimiterTimeoutIsNotResetByRepeatedHits(t *testing.T) {
	// A penalty is a fixed expiry set once when the bucket trips - hitting
	// the endpoint again while penalized must not push that expiry back
	// out, or a user who keeps retrying would never recover.
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1,
		GlobalRefillRate:   0,
		GlobalPenalty:      200 * time.Millisecond,
		EndpointCapacity:   1000,
		EndpointRefillRate: 1000,
		EndpointPenalty:    time.Millisecond,
	})

	l.Check("alice", "GET /posts", 1) // consumes the only token, trips the timeout

	first := l.Check("alice", "GET /posts", 1)
	if first.Allowed {
		t.Fatal("expected the timeout to already be active")
	}

	time.Sleep(100 * time.Millisecond)
	second := l.Check("alice", "GET /posts", 1)
	if second.Allowed {
		t.Fatal("still within the original timeout window")
	}

	if second.RetryAfter >= first.RetryAfter {
		t.Fatalf("RetryAfter did not shrink across repeated hits (first=%v, second=%v); a hit during timeout must not reset the penalty",
			first.RetryAfter, second.RetryAfter)
	}
	// Roughly 100ms should have burned off the original ~200ms window.
	if second.RetryAfter > 120*time.Millisecond {
		t.Fatalf("RetryAfter = %v, want roughly 100ms remaining", second.RetryAfter)
	}
}

func TestLimiterCleanupEvictsIdleEntries(t *testing.T) {
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     5,
		GlobalRefillRate:   1000, // refills the one consumed token in ~1ms
		GlobalPenalty:      time.Minute,
		EndpointCapacity:   5,
		EndpointRefillRate: 1000,
		EndpointPenalty:    time.Minute,
		CleanupInterval:    20 * time.Millisecond,
		IdleThreshold:      30 * time.Millisecond,
	})

	l.Check("alice", "GET /posts", 1) // creates both buckets and consumes one token from each

	if global, endpoint, _, _ := l.Len(); global != 1 || endpoint != 1 {
		t.Fatalf("Len() right after use = (%d, %d), want (1, 1)", global, endpoint)
	}

	// Wait past the idle threshold and at least one cleanup tick. The high
	// refill rate brings the bucket back to full almost immediately, and
	// it then sits untouched, so it becomes evictable.
	time.Sleep(120 * time.Millisecond)

	if global, endpoint, _, _ := l.Len(); global != 0 || endpoint != 0 {
		t.Fatalf("Len() after idle cleanup = (%d, %d), want (0, 0): idle, full buckets should have been evicted", global, endpoint)
	}
}

func TestLimiterCleanupExpiresPenaltyEntries(t *testing.T) {
	l := newTestLimiter(t, ratelimit.LimiterConfig{
		GlobalCapacity:     1,
		GlobalRefillRate:   0,
		GlobalPenalty:      10 * time.Millisecond,
		EndpointCapacity:   10,
		EndpointRefillRate: 1,
		EndpointPenalty:    time.Minute,
		CleanupInterval:    15 * time.Millisecond,
		IdleThreshold:      time.Hour, // irrelevant to penalty expiry
	})

	l.Check("alice", "GET /posts", 1)
	l.Check("alice", "GET /posts", 1) // trips the global timeout

	if _, _, globalPenalties, _ := l.Len(); globalPenalties != 1 {
		t.Fatalf("expected one global penalty entry, got %d", globalPenalties)
	}

	time.Sleep(60 * time.Millisecond) // penalty (10ms) plus a cleanup tick (15ms)

	if _, _, globalPenalties, _ := l.Len(); globalPenalties != 0 {
		t.Fatalf("expected the expired penalty entry to have been swept, got %d remaining", globalPenalties)
	}
}
