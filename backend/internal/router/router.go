package router

import (
	"net/http"

	"social/internal/auth"
	"social/internal/middleware"
)

// NewRouter builds the application's HTTP routes. The Go backend only
// exposes its JSON API under /api/; the frontend is served separately.
// Uploaded files (e.g. profile photos) are served under /uploads/ directly
// from uploadsDir so the frontend can reference them with a plain HTTP URL.
func NewRouter(authHandler *auth.Handler, authService *auth.Service, sessionCookieName, uploadsDir string) http.Handler {
	apiMux := http.NewServeMux()

	// Public API routes
	apiMux.HandleFunc("/login", authHandler.LoginHandler)
	apiMux.HandleFunc("/register", authHandler.RegisterHandler)

	// Protected API routes
	sessionMiddleware := middleware.SessionMiddleware(authService, sessionCookieName)
	apiMux.Handle("/logout", sessionMiddleware(http.HandlerFunc(authHandler.LogoutHandler)))

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", apiMux))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	return mux
}
