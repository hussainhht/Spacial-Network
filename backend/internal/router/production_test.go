package router_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"social/internal/config"
	"social/internal/router"
	"social/pkg/db/sqlite"
	"social/tests/testutil"
)

func TestProductionAuthenticationAndWebSocket(t *testing.T) {
	db := testutil.NewTestDB(t)
	testutil.CreateUser(t, db, testutil.NewUserOpts{Username: "deploytester", Email: "deploy@example.com", Password: "TestPassword123!"})
	cfg := config.Load()
	cfg.Production = true
	cfg.CookieSecure = true
	cfg.TrustedOrigins = []string{"https://social.example.com"}
	cfg.UploadsDir = t.TempDir()
	h, err := router.NewRouter(db, cfg)
	if err != nil {
		t.Fatal(err)
	}
	s := httptest.NewTLSServer(h)
	defer s.Close()
	client := s.Client()
	req, _ := http.NewRequest("POST", s.URL+"/api/login", strings.NewReader(`{"username":"deploytester","password":"TestPassword123!"}`))
	req.Header.Set("Origin", cfg.TrustedOrigins[0])
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("login status %d", resp.StatusCode)
	}
	cookies := resp.Cookies()
	if len(cookies) == 0 {
		t.Fatal("missing session cookie")
	}
	cookie := cookies[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Domain != "" || cookie.Path != "/" {
		t.Fatalf("unsafe cookie: %s", cookie)
	}
	// Copy trust from the test server client; no production TLS verification bypass.
	transport := client.Transport.(*http.Transport)
	dialer := websocket.Dialer{TLSClientConfig: transport.TLSClientConfig.Clone(), HandshakeTimeout: 3 * time.Second}
	url := "wss" + strings.TrimPrefix(s.URL, "https") + "/api/ws"
	headers := http.Header{"Origin": {cfg.TrustedOrigins[0]}}
	_, denied, err := dialer.Dial(url, headers)
	if err == nil || denied == nil || denied.StatusCode != 401 {
		t.Fatal("unauthenticated socket accepted")
	}
	denied.Body.Close()
	headers.Set("Cookie", cookie.String())
	headers.Set("Origin", "https://evil.example.com")
	_, denied, err = dialer.Dial(url, headers)
	if err == nil || denied == nil || denied.StatusCode != 403 {
		t.Fatal("cross-origin socket accepted")
	}
	denied.Body.Close()
	headers.Set("Origin", cfg.TrustedOrigins[0])
	conn, _, err := dialer.Dial(url, headers)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	if _, _, err := conn.ReadMessage(); err != nil {
		t.Fatalf("initial real-time event: %v", err)
	}
	for _, path := range []string{"/healthz", "/api/users/me"} {
		req, _ := http.NewRequest("GET", s.URL+path, nil)
		req.AddCookie(cookie)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("%s: %d", path, resp.StatusCode)
		}
	}
	resp, err = client.Get(s.URL + "/uploads/")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 404 {
		t.Fatal("uploads directory exposed")
	}
	// Logout must revoke the already-open socket, not just future handshakes.
	req, _ = http.NewRequest("POST", s.URL+"/api/logout", nil)
	req.Header.Set("Origin", cfg.TrustedOrigins[0])
	req.AddCookie(cookie)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("logout status %d", resp.StatusCode)
	}
	if err := conn.WriteMessage(websocket.TextMessage, []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if timeout, ok := err.(interface{ Timeout() bool }); ok && timeout.Timeout() {
				t.Fatal("revoked socket remained open")
			}
			break
		}
	}
}

func TestUploadedMediaCachePolicy(t *testing.T) {
	db := testutil.NewTestDB(t)
	cfg := config.Load()
	cfg.UploadsDir = t.TempDir()
	if err := os.WriteFile(filepath.Join(cfg.UploadsDir, "known-image.png"), []byte("media"), 0600); err != nil {
		t.Fatal(err)
	}
	h, err := router.NewRouter(db, cfg)
	if err != nil {
		t.Fatal(err)
	}
	for _, method := range []string{"GET", "HEAD"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(method, "/uploads/known-image.png", nil))
		if rec.Code != 200 || rec.Header().Get("Cache-Control") != "private, no-store" {
			t.Fatalf("%s: status %d headers %v", method, rec.Code, rec.Header())
		}
	}
}

func TestDatabasePersistsAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	db, err := sqlite.Open(dir, "persist.db")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("CREATE TABLE persistence(value TEXT); INSERT INTO persistence VALUES ('retained')"); err != nil {
		t.Fatal(err)
	}
	db.Close()
	info, err := os.Stat(filepath.Join(dir, "persist.db"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("database permissions %v", info.Mode())
	}
	db, err = sqlite.Open(dir, "persist.db")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var value string
	if err = db.QueryRow("SELECT value FROM persistence").Scan(&value); err != nil || value != "retained" {
		t.Fatalf("persistence: %s %v", value, err)
	}
}
