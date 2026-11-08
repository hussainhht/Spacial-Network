package middleware

import "net/http"

// CORS preserves the local development entry point.
func CORS(next http.Handler) http.Handler {
	return OriginSecurity(next, []string{"http://localhost:3000"}, false)
}

// OriginSecurity also protects cookie-authenticated writes (including login
// CSRF) and WebSocket handshakes. Origins are exact matches, never reflected
// without validation. Production writes must include Origin, even for CLI clients.
func OriginSecurity(next http.Handler, origins []string, production bool) http.Handler {
	allowed := make(map[string]bool)
	for _, origin := range origins {
		allowed[origin] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		write := r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS"
		ws := r.URL.Path == "/ws"
		w.Header().Add("Vary", "Origin")
		if (origin != "" && !allowed[origin]) || ((write || ws) && origin == "" && production) || ((write || ws) && r.Header.Get("Sec-Fetch-Site") == "cross-site") {
			http.Error(w, "Forbidden origin", http.StatusForbidden)
			return
		}
		if allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		r.Body = http.MaxBytesReader(w, r.Body, 25<<20)
		next.ServeHTTP(w, r)
	})
}
