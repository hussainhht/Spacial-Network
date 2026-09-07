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
	apiMux.Handle("/chat/conversations", sessionMiddleware(http.HandlerFunc(deps.Handlers.Chat.GetConversationsHandler)))

	apiMux.Handle(
		"/users/me",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Users.GetMeHandler)),
	)

	apiMux.Handle(
		"/users/me/privacy",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Users.UpdateProfilePrivacyHandler)),
	)

	apiMux.Handle(
		"/profiles/{username}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Users.GetProfileHandler)),
	)

	// =========================
	// Posts Routes
	// =========================

	apiMux.Handle(
		"POST /posts",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.NewPostHandler)),
	)
	apiMux.Handle(
		"GET /posts",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.ListPostsHandler)),
	)
	apiMux.Handle(
		"GET /posts/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.GetPostByIDHandler)),
	)
	apiMux.Handle(
		"PUT /posts/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.EditPostHandler)),
	)
	apiMux.Handle(
		"PATCH /posts/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.EditPostHandler)),
	)
	apiMux.Handle(
		"DELETE /posts/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Posts.DeletePostHandler)),
	)

	// =========================
	// Comments Routes - Future
	// =========================

	// TODO: Register Comments routes here once the Comments handler is implemented.

	// =========================
	// Followers Routes
	// =========================

	apiMux.Handle(
		"POST /profiles/{username}/follow",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.FollowUserHandler)),
	)
	apiMux.Handle(
		"DELETE /profiles/{username}/follow",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.UnfollowUserHandler)),
	)
	apiMux.Handle(
		"GET /profiles/{username}/followers",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.GetFollowersHandler)),
	)
	apiMux.Handle(
		"GET /profiles/{username}/following",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.GetFollowingHandler)),
	)
	apiMux.Handle(
		"GET /profiles/{username}/follow-status",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.FollowStatusHandler)),
	)

	// =========================
	// Groups Routes
	// =========================

	apiMux.Handle(
		"GET /groups",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.ListGroupsHandler)),
	)
	apiMux.Handle(
		"POST /groups",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.CreateGroupHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetGroupHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/members",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetGroupMembersHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/membership",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetMembershipHandler)),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.CreateJoinRequestHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/join-requests",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetPendingJoinRequestsHandler)),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests/{requestID}/accept",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.AcceptJoinRequestHandler)),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests/{requestID}/reject",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.RejectJoinRequestHandler)),
	)
	apiMux.Handle(
		"POST /groups/{id}/invitations",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.CreateGroupInvitationHandler)),
	)
	apiMux.Handle(
		"GET /group-invitations",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetPendingInvitationsHandler)),
	)
	apiMux.Handle(
		"POST /group-invitations/{invitationID}/accept",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.AcceptGroupInvitationHandler)),
	)
	apiMux.Handle(
		"POST /group-invitations/{invitationID}/decline",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.DeclineGroupInvitationHandler)),
	)

	// =========================
	// Chat Routes - Future
	// =========================

	// TODO: Register Chat routes here once the Chat handler is implemented.

	// =========================
	// Notifications Routes
	// =========================

	apiMux.Handle(
		"GET /notifications",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Notifications.ListNotificationsHandler)),
	)
	apiMux.Handle(
		"GET /notifications/unread-count",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Notifications.UnreadCountHandler)),
	)
	apiMux.Handle(
		"PATCH /notifications/read-all",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Notifications.MarkAllAsReadHandler)),
	)
	apiMux.Handle(
		"PATCH /notifications/{id}/read",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Notifications.MarkAsReadHandler)),
	)

	handler := middleware.CORS(apiMux)

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", handler))
	mux.Handle(
		"/uploads/",
		http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadsDir))),
	)

	return mux, nil
}
