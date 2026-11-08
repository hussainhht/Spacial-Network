package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProductionOrigins(t *testing.T) {
	h := OriginSecurity(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }), []string{"https://social.example.com"}, true)
	for _, tc := range []struct {
		method, path, origin string
		want                 int
	}{
		{"POST", "/login", "https://social.example.com", 204},
		{"POST", "/login", "https://evil.example.com", 403},
		{"POST", "/login", "null", 403},
		{"POST", "/login", "", 403},
		{"GET", "/ws", "", 403},
		{"GET", "/ws", "https://evil.example.com", 403},
		{"GET", "/ws", "https://social.example.com", 204},
		{"GET", "/users/me", "", 204},
		{"OPTIONS", "/login", "https://social.example.com", 204},
	} {
		r := httptest.NewRequest(tc.method, tc.path, nil)
		r.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Errorf("%s %s origin=%q got %d want %d", tc.method, tc.path, tc.origin, w.Code, tc.want)
		}
		if tc.want == 403 && w.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatal("untrusted CORS origin reflected")
		}
	}
}
func TestProxyTrust(t *testing.T) {
	for _, trust := range []bool{false, true} {
		h := ProxyHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			want := "192.0.2.1:1234"
			if trust {
				want = "198.51.100.1:0"
			}
			if r.RemoteAddr != want {
				t.Errorf("got %s want %s", r.RemoteAddr, want)
			}
		}), trust)
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = "192.0.2.1:1234"
		r.Header.Set("X-Real-IP", "198.51.100.1")
		r.Header.Set("X-Forwarded-For", "attacker")
		h.ServeHTTP(httptest.NewRecorder(), r)
	}
}
