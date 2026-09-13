package config

import (
	"os"
	"time"
)

type Config struct {
	ServerPort string

	DBDir  string
	DBFile string

	SessionCookieName string
	SessionLifetime   time.Duration
	CookieSecure      bool

	UploadsDir    string
	MaxAvatarSize int64
	MaxMediaSize  int64

	// RateLimit* configure internal/ratelimit's two-tier limiter: a global
	// (hard) cap shared across every endpoint, and a per-endpoint (soft)
	// cap. See internal/ratelimit/README.md for how to tune these.
	RateLimitGlobalCapacity     float64
	RateLimitGlobalRefillRate   float64 // tokens/sec
	RateLimitGlobalPenalty      time.Duration
	RateLimitEndpointCapacity   float64
	RateLimitEndpointRefillRate float64 // tokens/sec
	RateLimitEndpointPenalty    time.Duration
}

func Load() Config {
	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	return Config{
		ServerPort: serverPort,

		DBDir:  "data",
		DBFile: "social-network.db",

		SessionCookieName: "session_token",
		SessionLifetime:   24 * time.Hour,
		CookieSecure:      false,

		UploadsDir:    "data/uploads",
		MaxAvatarSize: 5 << 20, // 5 MiB
		MaxMediaSize:  5 << 20, // 5 MiB, per post/comment attachment

		// Global: burst up to 30 requests, sustain 10 req/s, 30s timeout
		// once exhausted.
		RateLimitGlobalCapacity:   30,
		RateLimitGlobalRefillRate: 10,
		RateLimitGlobalPenalty:    30 * time.Second,
		// Endpoint: burst up to 10 requests, sustain 3 req/s per endpoint,
		// 15s timeout once exhausted.
		RateLimitEndpointCapacity:   10,
		RateLimitEndpointRefillRate: 3,
		RateLimitEndpointPenalty:    15 * time.Second,
	}
}
