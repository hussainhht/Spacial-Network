package router

import (
	"net/http"

	"social/internal/auth"
	"social/internal/middleware"
)

const (
	indexPath   = "web/public/index.html"
	srcDir      = "web/src"
	faviconPath = "web/src/static/icons/favicon.ico"
	iconPath    = "web/src/static/icons/general.png"
)

// New builds the application's HTTP routes.
func New(authHandler *auth.Handler, authService *auth.Service, sessionCookieName string) http.Handler {
	mux := http.NewServeMux()

	// Home
	mux.HandleFunc("/", handleHome)

	// Static assets
	mux.Handle("/src/", http.StripPrefix("/src/", http.FileServer(http.Dir(srcDir))))
	mux.HandleFunc("/favicon.ico", handleFavicon)
	mux.HandleFunc("/static/icons/general.png", handleGeneralIcon)

	// Public routes
	mux.HandleFunc("/login", authHandler.LoginHandler)
	mux.HandleFunc("/register", authHandler.RegisterHandler)

	// Protected API sub-router
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/logout", authHandler.LogoutHandler)

	// Apply middleware ONLY to API
	protectedAPI := middleware.SessionMiddleware(authService, sessionCookieName)(apiMux)

	// Mount under /api/
	mux.Handle("/api/", http.StripPrefix("/api", protectedAPI))

	return mux
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, indexPath)
}

func handleFavicon(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, faviconPath)
}

func handleGeneralIcon(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, iconPath)
}
