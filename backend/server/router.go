package server

import (
	"net/http"

	"social/handlers"
	"social/middleware"
)

func NewRouter() http.Handler {
	mux := http.NewServeMux()

	// Home
	mux.HandleFunc("/", handlers.HandleHome)

	// Static assets
	mux.Handle("/src/", handlers.SrcFileServer())
	mux.HandleFunc("/favicon.ico", handlers.Favicon)
	mux.HandleFunc("/static/icons/general.png", handlers.GeneralIconHandler)

	// Public routes
	mux.HandleFunc("/login", handlers.LoginHandler)
	mux.HandleFunc("/register", handlers.RegisterRequest)

	// Protected API sub-router
	apiMux := http.NewServeMux()

	// Apply middleware ONLY to API
	protectedAPI := middleware.SessionMiddleware()(apiMux)

	// Mount under /api/
	mux.Handle("/api/", http.StripPrefix("/api", protectedAPI))

	// API routes
	// apiMux.HandleFunc("/app", handlers.AppConfigHandler)
	// apiMux.HandleFunc("/current-user", handlers.CurrentUserHandler)
	// apiMux.HandleFunc("/heartbeat", handlers.HeartbeatHandler)
	// apiMux.HandleFunc("/checkUpdates", handlers.CheckUpdatesHandler)
	// apiMux.HandleFunc("/messages", handlers.PrivateMessagesHandler)
	// apiMux.HandleFunc("/posts", handlers.PostsHandler)
	// apiMux.HandleFunc("/post", handlers.PostDetailsHandler)
	// apiMux.HandleFunc("/post/vote", handlers.PostVoteHandler)
	// apiMux.HandleFunc("/post/comment", handlers.PostCommentHandler)
	// apiMux.HandleFunc("/newPost", handlers.NewPostHandler)
	apiMux.HandleFunc("/logout", handlers.LogoutHandler)

	// WebSocket
	// mux.HandleFunc("/ws", WsInit)

	return mux
}
