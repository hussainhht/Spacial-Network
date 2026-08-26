package config

import "time"

type Config struct {
	ServerPort string

	DBDir  string
	DBFile string

	SessionCookieName string
	SessionLifetime   time.Duration
	CookieSecure      bool
}

func Load() Config {
	return Config{
		ServerPort: "8080",

		DBDir:  "data",
		DBFile: "social-network.db",

		SessionCookieName: "session_token",
		SessionLifetime:   30 * time.Minute,
		CookieSecure:      false,
	}
}