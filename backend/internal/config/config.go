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
}

func Load() Config {
	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	return Config{
		ServerPort: serverPort,

		DBDir:  "../../data",
		DBFile: "social-network.db",

		SessionCookieName: "session_token",
		SessionLifetime:   24 * time.Hour,
		CookieSecure:      false,

		UploadsDir:    "data/uploads",
		MaxAvatarSize: 5 << 20, // 5 MiB
	}
}
