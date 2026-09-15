package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

// LimiterConfig configures a Limiter's two tiers.
type LimiterConfig struct {
	// GlobalCapacity/GlobalRefillRate/GlobalPenalty govern the hard cap:
	// one bucket per user, shared across every endpoint.
	GlobalCapacity   float64
	GlobalRefillRate float64 // tokens/sec
	GlobalPenalty    time.Duration

	// EndpointCapacity/EndpointRefillRate/EndpointPenalty govern the soft
	// cap: one bucket per (user, endpoint) pair.
	EndpointCapacity   float64
	EndpointRefillRate float64
	EndpointPenalty    time.Duration

	// RequestCost weighs a request's token cost against both tiers. Nil
	// defaults to a flat 1.0 for every request.
	RequestCost func(r *http.Request) float64

	// CleanupInterval controls how often the idle-eviction sweep runs.
	// Defaults to 2 minutes.
	CleanupInterval time.Duration
	// IdleThreshold is how long a full, untouched bucket (or an expired
	// penalty) must sit before the sweep evicts it. Defaults to 10 minutes.
	IdleThreshold time.Duration
}

// Decision is the outcome of a rate-limit check, carrying enough detail to
// write both the 429 response and the success headers.
type Decision struct {
	Allowed bool

	// Limited is "global" or "endpoint" when Allowed is false; empty
	// otherwise.
	Limited string
	// RetryAfter is how long the caller must wait before retrying. While a
	// timeout is active this is time-until-timeout-expiry, not
	// time-until-bucket-refill - the two can differ, and the timeout wins.
	RetryAfter time.Duration

	GlobalRemaining   float64
	GlobalLimit       float64
	EndpointRemaining float64
	EndpointLimit     float64
}

// Limiter enforces a per-user global bucket and a per-(user, endpoint)
// bucket, each backed by its own timeout once it empties.
//
// The four maps use sync.Map rather than a single mutex-guarded map so that
// requests from different users (or different endpoints) never contend on
// the same lock; the only per-key serialization is inside each Bucket
// itself, for the (rare) case of two concurrent requests from the same
// user hitting the same bucket.
type Limiter struct {
	cfg LimiterConfig

	globalBuckets   sync.Map // userID string -> *Bucket
	endpointBuckets sync.Map // userID+":"+endpoint string -> *Bucket

	globalPenalty   sync.Map // userID string -> time.Time
	endpointPenalty sync.Map // userID+":"+endpoint string -> time.Time

	stopOnce sync.Once
	stopCh   chan struct{}
}

// NewLimiter builds a Limiter and starts its background cleanup goroutine.
// Call Close when done with it (tests in particular should, to avoid
// leaking the goroutine).
func NewLimiter(cfg LimiterConfig) *Limiter {
	if cfg.RequestCost == nil {
		cfg.RequestCost = func(*http.Request) float64 { return 1.0 }
	}
	if cfg.CleanupInterval <= 0 {
		cfg.CleanupInterval = 2 * time.Minute
	}
	if cfg.IdleThreshold <= 0 {
		cfg.IdleThreshold = 10 * time.Minute
	}

	l := &Limiter{
		cfg:    cfg,
		stopCh: make(chan struct{}),
	}
	go l.cleanupLoop()
	return l
}

// Close stops the background cleanup goroutine. Safe to call more than
// once; safe to skip if the Limiter lives for the lifetime of the process.
func (l *Limiter) Close() {
	l.stopOnce.Do(func() { close(l.stopCh) })
}

// Cost applies the configured RequestCost function to r, so callers (e.g.
// the HTTP middleware in internal/middleware) don't need access to the
// Limiter's otherwise-private config to weigh a request before calling
// Check.
func (l *Limiter) Cost(r *http.Request) float64 {
	return l.cfg.RequestCost(r)
}

// Len reports how many entries are currently tracked in each of the four
// maps. It's intended for tests (verifying the cleanup sweep actually
// evicts things) and for operational metrics - e.g. exporting a gauge of
// how many users/endpoints the limiter is currently tracking.
func (l *Limiter) Len() (globalBuckets, endpointBuckets, globalPenalties, endpointPenalties int) {
	l.globalBuckets.Range(func(_, _ any) bool { globalBuckets++; return true })
	l.endpointBuckets.Range(func(_, _ any) bool { endpointBuckets++; return true })
	l.globalPenalty.Range(func(_, _ any) bool { globalPenalties++; return true })
	l.endpointPenalty.Range(func(_, _ any) bool { endpointPenalties++; return true })
	return
}

// Check runs the two-tier rate-limit decision for one request, in order:
// global timeout, endpoint timeout, global bucket, endpoint bucket. The
// global bucket is charged before the endpoint bucket is even consulted;
// if the endpoint bucket then rejects, the global charge is deliberately
// not refunded, since the request did consume global capacity by being
// attempted.
func (l *Limiter) Check(userID, endpoint string, cost float64) Decision {
	now := time.Now()
	endpointKey := userID + ":" + endpoint

	if until, ok := l.penalized(&l.globalPenalty, userID, now); ok {
		return Decision{Allowed: false, Limited: "global", RetryAfter: until.Sub(now)}
	}
	if until, ok := l.penalized(&l.endpointPenalty, endpointKey, now); ok {
		return Decision{Allowed: false, Limited: "endpoint", RetryAfter: until.Sub(now)}
	}

	gb := l.bucketFor(&l.globalBuckets, userID, l.cfg.GlobalCapacity, l.cfg.GlobalRefillRate)
	if !gb.Consume(cost) {
		until := now.Add(l.cfg.GlobalPenalty)
		l.globalPenalty.Store(userID, until)
		return Decision{
			Allowed: false, Limited: "global", RetryAfter: until.Sub(now),
			GlobalRemaining: gb.Level(), GlobalLimit: gb.Capacity(),
		}
	}

	eb := l.bucketFor(&l.endpointBuckets, endpointKey, l.cfg.EndpointCapacity, l.cfg.EndpointRefillRate)
	if !eb.Consume(cost) {
		until := now.Add(l.cfg.EndpointPenalty)
		l.endpointPenalty.Store(endpointKey, until)
		return Decision{
			Allowed: false, Limited: "endpoint", RetryAfter: until.Sub(now),
			GlobalRemaining: gb.Level(), GlobalLimit: gb.Capacity(),
			EndpointRemaining: eb.Level(), EndpointLimit: eb.Capacity(),
		}
	}

	return Decision{
		Allowed:         true,
		GlobalRemaining: gb.Level(), GlobalLimit: gb.Capacity(),
		EndpointRemaining: eb.Level(), EndpointLimit: eb.Capacity(),
	}
}

// penalized reports whether key is still within its timeout as of now.
func (l *Limiter) penalized(m *sync.Map, key string, now time.Time) (time.Time, bool) {
	v, ok := m.Load(key)
	if !ok {
		return time.Time{}, false
	}
	until := v.(time.Time)
	if !until.After(now) {
		return time.Time{}, false
	}
	return until, true
}

// bucketFor fetches key's bucket, creating and atomically installing a
// fresh (full) one on first use.
func (l *Limiter) bucketFor(m *sync.Map, key string, capacity, refillRate float64) *Bucket {
	if v, ok := m.Load(key); ok {
		return v.(*Bucket)
	}
	fresh := NewBucket(capacity, refillRate)
	actual, _ := m.LoadOrStore(key, fresh)
	return actual.(*Bucket)
}

func (l *Limiter) cleanupLoop() {
	ticker := time.NewTicker(l.cfg.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-l.stopCh:
			return
		case now := <-ticker.C:
			l.cleanup(now)
		}
	}
}

// cleanup evicts buckets that are full and have sat idle past
// IdleThreshold, and drops any timeout entries that have already expired.
// Deleting from a sync.Map while ranging over it is safe by design.
func (l *Limiter) cleanup(now time.Time) {
	l.globalBuckets.Range(func(k, v any) bool {
		if v.(*Bucket).Evictable(now, l.cfg.IdleThreshold) {
			l.globalBuckets.Delete(k)
		}
		return true
	})
	l.endpointBuckets.Range(func(k, v any) bool {
		if v.(*Bucket).Evictable(now, l.cfg.IdleThreshold) {
			l.endpointBuckets.Delete(k)
		}
		return true
	})
	l.globalPenalty.Range(func(k, v any) bool {
		if !v.(time.Time).After(now) {
			l.globalPenalty.Delete(k)
		}
		return true
	})
	l.endpointPenalty.Range(func(k, v any) bool {
		if !v.(time.Time).After(now) {
			l.endpointPenalty.Delete(k)
		}
		return true
	})
}
