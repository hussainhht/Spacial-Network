package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerHost string
	ServerPort string

	DBDir  string
	DBFile string

	SessionCookieName string
	SessionLifetime   time.Duration
	CookieSecure      bool
}

// Load builds a Config from environment variables, falling back to
// development-friendly defaults for anything unset or invalid.
func Load() Config {
	return Config{
		ServerHost: getEnv("SERVER_HOST", "localhost"),
		ServerPort: getEnv("SERVER_PORT", "8080"),

		DBDir:  getEnv("DB_DIR", "data"),
		DBFile: getEnv("DB_FILE", "social-network.db"),

		SessionCookieName: getEnv("SESSION_COOKIE_NAME", "session_token"),
		SessionLifetime:   getDurationEnv("SESSION_LIFETIME", 30*time.Minute),
		CookieSecure:      getBoolEnv("COOKIE_SECURE", false),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func getBoolEnv(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
