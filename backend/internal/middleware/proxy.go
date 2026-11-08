package middleware

import (
	"net"
	"net/http"
)

// Enable only with an isolated backend network: Nginx overwrites this header.
// Never trust client-supplied X-Forwarded-For or CF-Connecting-IP here.
func ProxyHeaders(next http.Handler, trust bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if trust {
			if ip := net.ParseIP(r.Header.Get("X-Real-IP")); ip != nil {
				r.RemoteAddr = net.JoinHostPort(ip.String(), "0")
			}
		}
		next.ServeHTTP(w, r)
	})
}
