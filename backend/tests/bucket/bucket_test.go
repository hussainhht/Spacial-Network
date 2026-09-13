// Package ratelimit_test exercises social/internal/ratelimit as a
// black box, through its exported API only - the way any other consumer
// of the package would.
package ratelimit_test

import (
	"sync"
	"testing"
	"time"

	"social/internal/ratelimit"
)

// tolerance absorbs real scheduling jitter (sleeps are never perfectly
// precise) in the timing-based assertions below.
const tolerance = 0.15

func TestBucketStartsFull(t *testing.T) {
	b := ratelimit.NewBucket(10, 1)
	if got := b.Level(); got != 10 {
		t.Fatalf("Level() = %v, want 10", got)
	}
	if got := b.Capacity(); got != 10 {
		t.Fatalf("Capacity() = %v, want 10", got)
	}
}

func TestBucketRefillMath(t *testing.T) {
	tests := []struct {
		name       string
		capacity   float64
		refillRate float64
		drainTo    float64 // level to leave the bucket at before waiting
		sleep      time.Duration
		wantLevel  float64
	}{
		{
			name: "no time elapsed, no refill", capacity: 10, refillRate: 1,
			drainTo: 4, sleep: 0, wantLevel: 4,
		},
		{
			name: "partial second, fractional refill", capacity: 10, refillRate: 10,
			drainTo: 4, sleep: 50 * time.Millisecond, wantLevel: 4.5,
		},
		{
			name: "several intervals", capacity: 10, refillRate: 20,
			drainTo: 0, sleep: 150 * time.Millisecond, wantLevel: 3,
		},
		{
			name: "refill caps at capacity", capacity: 10, refillRate: 50,
			drainTo: 8, sleep: 100 * time.Millisecond, wantLevel: 10,
		},
		{
			name: "fractional refill rate", capacity: 5, refillRate: 2,
			drainTo: 0, sleep: 300 * time.Millisecond, wantLevel: 0.6,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := ratelimit.NewBucket(tt.capacity, tt.refillRate)
			if drain := tt.capacity - tt.drainTo; drain > 0 {
				if !b.Consume(drain) {
					t.Fatalf("setup: Consume(%v) to drain to %v should succeed", drain, tt.drainTo)
				}
			}

			time.Sleep(tt.sleep)

			got := b.Level()
			if diff := got - tt.wantLevel; diff > tolerance || diff < -tolerance {
				t.Fatalf("Level() = %v, want ~%v (+/- %v)", got, tt.wantLevel, tolerance)
			}
		})
	}
}

func TestBucketConsume(t *testing.T) {
	b := ratelimit.NewBucket(5, 0) // no refill, so behavior is deterministic

	if !b.Consume(2) {
		t.Fatal("Consume(2) on a full bucket of capacity 5 should succeed")
	}
	if got := b.Level(); got != 3 {
		t.Fatalf("Level() after Consume(2) = %v, want 3", got)
	}

	if !b.Consume(3) {
		t.Fatal("Consume(3) should drain the bucket exactly to 0")
	}
	if got := b.Level(); got != 0 {
		t.Fatalf("Level() after draining = %v, want 0", got)
	}

	if b.Consume(0.001) {
		t.Fatal("Consume on an empty bucket should fail")
	}
	if got := b.Level(); got != 0 {
		t.Fatalf("a failed Consume must not change the level, got %v", got)
	}
}

func TestBucketConsumeFractionalCost(t *testing.T) {
	b := ratelimit.NewBucket(1, 0)

	for i := 0; i < 4; i++ {
		if !b.Consume(0.25) {
			t.Fatalf("Consume(0.25) #%d should succeed", i)
		}
	}
	if b.Consume(0.01) {
		t.Fatal("bucket should be fully drained after four 0.25 consumes")
	}
}

// TestBucketConcurrentConsume hammers a single bucket from many goroutines
// and asserts that exactly `capacity` units were ever handed out - not one
// more. refillRate is 0 so the total is deterministic; run with -race to
// confirm level/lastRefill aren't corrupted by concurrent access.
func TestBucketConcurrentConsume(t *testing.T) {
	const capacity = 100
	const workers = 50
	const attemptsPerWorker = 10

	b := ratelimit.NewBucket(capacity, 0)

	var successes int64
	var mu sync.Mutex
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < attemptsPerWorker; j++ {
				if b.Consume(1) {
					mu.Lock()
					successes++
					mu.Unlock()
				}
			}
		}()
	}
	wg.Wait()

	if successes != capacity {
		t.Fatalf("successful consumes = %d, want exactly %d", successes, capacity)
	}
	if got := b.Level(); got != 0 {
		t.Fatalf("Level() after exhausting the bucket = %v, want 0", got)
	}
}

func TestBucketEvictable(t *testing.T) {
	t.Run("full and idle is evictable", func(t *testing.T) {
		b := ratelimit.NewBucket(10, 1)
		time.Sleep(30 * time.Millisecond)
		if !b.Evictable(time.Now(), 20*time.Millisecond) {
			t.Fatal("expected a full, long-idle bucket to be evictable")
		}
	})

	t.Run("drained recently is not evictable even though idle threshold alone would pass", func(t *testing.T) {
		b := ratelimit.NewBucket(10, 0) // refillRate 0: will never reach capacity again
		if !b.Consume(8) {
			t.Fatal("setup: draining the bucket should succeed")
		}
		time.Sleep(30 * time.Millisecond)
		if b.Evictable(time.Now(), 20*time.Millisecond) {
			t.Fatal("a bucket sitting below capacity must not be evicted")
		}
	})

	t.Run("full but recently touched is not evictable", func(t *testing.T) {
		b := ratelimit.NewBucket(10, 1)
		if b.Evictable(time.Now(), time.Hour) {
			t.Fatal("a recently touched bucket must not be evicted")
		}
	})
}
