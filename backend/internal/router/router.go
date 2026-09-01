package router

import (
	"database/sql"
	"log"
	"net/http"

	"social/internal/config"
	"social/internal/middleware"
)

// NewRouter builds the application's HTTP routes. The Go backend only
// exposes its JSON API under /api/; the frontend is served separately.
// Uploaded files (e.g. profile photos) are served under /uploads/ directly
// from the configured uploads directory so the frontend can reference them
// with a plain HTTP URL.
func NewRouter(db *sql.DB, cfg config.Config) (http.Handler, error) {
	deps, err := setupDependencies(db, cfg)
	if err != nil {
		return nil, err
	}

	if _, err := deps.AuthService.CleanupSessions(); err != nil {
		log.Println("session cleanup:", err)
	}

	apiMux := http.NewServeMux()

	//* Public API routes
	apiMux.HandleFunc("/login", deps.Handlers.Auth.LoginHandler)
	apiMux.HandleFunc("/register", deps.Handlers.Auth.RegisterHandler)

	//* Protected API routes
	sessionMiddleware := middleware.SessionMiddleware(
		deps.AuthService,
		cfg.SessionCookieName,
	)
	apiMux.Handle(
		"/logout",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Auth.LogoutHandler)),
	)

	apiMux.Handle("/ws", sessionMiddleware(http.HandlerFunc(deps.Handlers.Websocket.ServeWS)))
	apiMux.Handle("/chat/history", sessionMiddleware(http.HandlerFunc(deps.Handlers.Chat.GetHistoryHandler)))
	apiMux.Handle("chat/conversations", sessionMiddleware(http.HandlerFunc(deps.Handlers.Chat.GetConversationsHandler)))
	// =========================
	// Posts Routes - Future
	// =========================

	// TODO: Register Posts routes here once the Posts handler is implemented.

	// =========================
	// Comments Routes - Future
	// =========================

	// TODO: Register Comments routes here once the Comments handler is implemented.

	// =========================
	// Followers Routes - Future
	// =========================

	// TODO: Register Followers routes here once the Followers handler is implemented.

	// =========================
	// Groups Routes - Future
	// =========================

	// TODO: Register Groups routes here once the Groups handler is implemented.

	// =========================
	// Chat Routes - Future
	// =========================

	// TODO: Register Chat routes here once the Chat handler is implemented.

	// =========================
	// Notifications Routes - Future
	// =========================

	// TODO: Register Notifications routes here once the Notifications handler is implemented.
	handler := middleware.CORS(apiMux)

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", handler))
	mux.Handle(
		"/uploads/",
		http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadsDir))),
	)

	return mux, nil
}
