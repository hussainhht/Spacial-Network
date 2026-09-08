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
	// Comments Routes
	// =========================

	apiMux.Handle(
		"POST /posts/{id}/comments",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Comments.NewCommentHandler)),
	)
	apiMux.Handle(
		"GET /posts/{id}/comments",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Comments.ListCommentsHandler)),
	)
	apiMux.Handle(
		"DELETE /comments/{commentID}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Comments.DeleteCommentHandler)),
	)

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
	apiMux.Handle(
		"GET /follow-requests",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.GetPendingFollowRequestsHandler)),
	)

	apiMux.Handle(
		"POST /follow-requests/{requestID}/accept",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.AcceptFollowRequestHandler)),
	)
	apiMux.Handle(
		"POST /follow-requests/{requestID}/decline",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Followers.DeclineFollowRequestHandler)),
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
		"GET /groups/mine",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetMyGroupsHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetGroupHandler)),
	)
	apiMux.Handle(
		"PUT /groups/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.UpdateGroupHandler)),
	)
	apiMux.Handle(
		"DELETE /groups/{id}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.DeleteGroupHandler)),
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
		"DELETE /groups/{id}/members/{memberID}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.RemoveMemberHandler)),
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
	// Group Events Routes
	// =========================

	apiMux.Handle(
		"POST /groups/{id}/events",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.CreateEventHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/events",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetGroupEventsHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/events/{eventID}",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetEventHandler)),
	)
	apiMux.Handle(
		"GET /groups/{id}/events/{eventID}/responses",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.GetEventResponsesHandler)),
	)
	apiMux.Handle(
		"PUT /groups/{id}/events/{eventID}/response",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Groups.RespondToEventHandler)),
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
