package websocket

import (
	"net/http/httptest"
	"social/internal/config"
	"testing"
)

func TestProductionWebSocketOrigin(t *testing.T) {
	u := newUpgrader(config.Config{Production: true, TrustedOrigins: []string{"https://social.example.com"}})
	for _, origin := range []string{"https://social.example.com", "https://evil.example.com", "null", ""} {
		r := httptest.NewRequest("GET", "/api/ws", nil)
		r.Header.Set("Origin", origin)
		if u.CheckOrigin(r) != (origin == "https://social.example.com") {
			t.Errorf("origin %q", origin)
		}
	}
}
