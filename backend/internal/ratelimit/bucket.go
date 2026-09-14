// Package ratelimit implements per-user, two-tier (global + per-endpoint)
// token-bucket rate limiting as HTTP middleware. See README.md for how to
// wire it in and how to tune the config for a target request rate.
package ratelimit

import (
	"sync"
	"time"
)

// Bucket is a single token bucket. It refills lazily - the fill level is
// only recomputed when something touches the bucket (Consume/Level/
// Evictable) - rather than via a per-bucket background ticker, which would
// not scale to one (or two) buckets per user.
//
// All state is guarded by mu so a Bucket can be shared across concurrent
// requests from the same user without racing on level/lastRefill.
type Bucket struct {
	mu sync.Mutex

	capacity   float64
	level      float64
	refillRate float64 // tokens added per second
	lastRefill time.Time
}

// NewBucket creates a bucket that starts full.
func NewBucket(capacity, refillRate float64) *Bucket {
	return &Bucket{
		capacity:   capacity,
		level:      capacity,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// refill adds tokens accrued since lastRefill, capped at capacity.
// Callers must hold mu.
func (b *Bucket) refill(now time.Time) {
	if elapsed := now.Sub(b.lastRefill).Seconds(); elapsed > 0 {
		b.level += elapsed * b.refillRate
		if b.level > b.capacity {
			b.level = b.capacity
		}
		b.lastRefill = now
	}
}

// Consume refills the bucket, then attempts to deduct cost tokens. It
// returns true and deducts cost if the bucket held enough; otherwise it
// returns false and leaves the level unchanged.
func (b *Bucket) Consume(cost float64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.refill(time.Now())
	if b.level >= cost {
		b.level -= cost
		return true
	}
	return false
}

// Level returns the current fill level, after applying any pending refill.
func (b *Bucket) Level() float64 {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.refill(time.Now())
	return b.level
}

// Capacity returns the bucket's max fill level.
func (b *Bucket) Capacity() float64 {
	return b.capacity
}

// Evictable reports whether the bucket has been untouched for at least
// idleThreshold and - projecting its refill forward to now - sits at full
// capacity. Both conditions matter: a bucket sitting below capacity is
// still "in use" by whatever drained it (its owner may come back before it
// refills), so it must not be dropped just because nobody has requested
// since; conversely a fresh, full bucket that no one has ever touched is
// evictable as soon as it goes idle.
//
// This is a read-only check: it must not call refill and persist the
// result, or a periodic cleanup sweep that runs more often than
// idleThreshold (the normal case) would repeatedly touch lastRefill itself
// and the bucket would never appear idle.
func (b *Bucket) Evictable(now time.Time, idleThreshold time.Duration) bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	idleFor := now.Sub(b.lastRefill)
	if idleFor < idleThreshold {
		return false
	}

	level := b.level + idleFor.Seconds()*b.refillRate
	if level > b.capacity {
		level = b.capacity
	}
	return level >= b.capacity
}
