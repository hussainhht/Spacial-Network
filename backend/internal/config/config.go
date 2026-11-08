package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Config struct {
	ServerPort     string
	Production     bool
	TrustedOrigins []string
	TrustProxy     bool

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
		ServerPort:     serverPort,
		Production:     os.Getenv("APP_ENV") == "production",
		TrustedOrigins: strings.Split(env("TRUSTED_ORIGINS", "http://localhost:3000"), ","),
		TrustProxy:     os.Getenv("TRUST_PROXY") == "true",

		DBDir:  env("DB_DIR", "data"),
		DBFile: env("DB_FILE", "social-network.db"),

		SessionCookieName: "session_token",
		SessionLifetime:   24 * time.Hour,
		CookieSecure:      os.Getenv("APP_ENV") == "production" || os.Getenv("COOKIE_SECURE") == "true",

		UploadsDir:    env("UPLOADS_DIR", "data/uploads"),
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

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Validate fails closed on an unsafe production origin/cookie configuration.
func (c Config) Validate() error {
	if filepath.Base(c.DBFile) != c.DBFile || c.DBFile == "." {
		return fmt.Errorf("DB_FILE must be a filename")
	}
	if c.Production && !c.CookieSecure {
		return fmt.Errorf("production requires secure cookies")
	}
	for _, origin := range c.TrustedOrigins {
		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "http" && u.Scheme != "https") {
			return fmt.Errorf("invalid trusted origin %q", origin)
		}
		if c.Production && (u.Scheme != "https" || u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1") {
			return fmt.Errorf("production requires public HTTPS trusted origins")
		}
	}
	if len(c.TrustedOrigins) == 0 {
		return fmt.Errorf("trusted origins required")
	}
	return nil
}
