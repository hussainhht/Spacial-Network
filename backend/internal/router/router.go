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

	// rateLimit enforces internal/ratelimit's two-tier (global + per-
	// endpoint) cap on every route below, keyed by the authenticated
	// session user where available (falling back to IP on the public
	// login/register routes, which run before any session exists).
	rateLimit := middleware.RateLimit(deps.RateLimiter, nil, nil)

	//* Public API routes
	apiMux.Handle("/login", rateLimit(http.HandlerFunc(deps.Handlers.Auth.LoginHandler)))
	apiMux.Handle("/register", rateLimit(http.HandlerFunc(deps.Handlers.Auth.RegisterHandler)))

	//* Protected API routes
	sessionMiddleware := middleware.SessionMiddleware(
		deps.AuthService,
		cfg.SessionCookieName,
	)
	apiMux.Handle(
		"/logout",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Auth.LogoutHandler))),
	)

	apiMux.Handle("GET /ws", sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Websocket.ServeWS))))
	apiMux.Handle("GET /chat/history", sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Chat.GetHistoryHandler))))
	apiMux.Handle("GET /chat/conversations", sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Chat.GetConversationsHandler))))
	apiMux.Handle("GET /chat/eligible-contacts", sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Chat.GetEligibleContactsHandler))))

	apiMux.Handle(
		"/users/me",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Users.GetMeHandler))),
	)

	apiMux.Handle(
		"/users/me/privacy",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Users.UpdateProfilePrivacyHandler))),
	)

	apiMux.Handle(
		"PATCH /users/me/profile",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Users.UpdateProfileDetailsHandler))),
	)

	apiMux.Handle(
		"PATCH /users/me/avatar",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Users.UpdateProfileAvatarHandler))),
	)

	apiMux.Handle(
		"/profiles/{username}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Users.GetProfileHandler))),
	)

	// =========================
	// Posts Routes
	// =========================

	apiMux.Handle(
		"POST /posts",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.NewPostHandler))),
	)
	apiMux.Handle(
		"GET /posts",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.ListPostsHandler))),
	)
	apiMux.Handle(
		"GET /posts/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.GetPostByIDHandler))),
	)
	apiMux.Handle(
		"PUT /posts/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.EditPostHandler))),
	)
	apiMux.Handle(
		"PATCH /posts/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.EditPostHandler))),
	)
	apiMux.Handle(
		"DELETE /posts/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.DeletePostHandler))),
	)

	// =========================
	// Comments Routes
	// =========================

	apiMux.Handle(
		"POST /posts/{id}/comments",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Comments.NewCommentHandler))),
	)
	apiMux.Handle(
		"GET /posts/{id}/comments",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Comments.ListCommentsHandler))),
	)
	apiMux.Handle(
		"GET /posts/{id}/comments/count",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Comments.GetCommentCountHandler))),
	)
	apiMux.Handle(
		"DELETE /comments/{commentID}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Comments.DeleteCommentHandler))),
	)

	// =========================
	// Likes Routes
	// =========================

	apiMux.Handle(
		"GET /posts/{id}/likes",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Likes.GetLikeStatusHandler))),
	)
	apiMux.Handle(
		"POST /posts/{id}/likes",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Likes.LikePostHandler))),
	)
	apiMux.Handle(
		"DELETE /posts/{id}/likes",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Likes.UnlikePostHandler))),
	)

	// =========================
	// Share Routes
	// =========================

	apiMux.Handle(
		"POST /posts/{id}/share",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Share.SharePostHandler))),
	)

	// =========================
	// Followers Routes
	// =========================

	apiMux.Handle(
		"POST /profiles/{username}/follow",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.FollowUserHandler))),
	)
	apiMux.Handle(
		"DELETE /profiles/{username}/follow",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.UnfollowUserHandler))),
	)
	apiMux.Handle(
		"GET /profiles/{username}/followers",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.GetFollowersHandler))),
	)
	apiMux.Handle(
		"GET /profiles/{username}/following",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.GetFollowingHandler))),
	)
	apiMux.Handle(
		"GET /profiles/{username}/follow-status",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.FollowStatusHandler))),
	)
	apiMux.Handle(
		"GET /follow-requests",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.GetPendingFollowRequestsHandler))),
	)

	apiMux.Handle(
		"POST /follow-requests/{requestID}/accept",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.AcceptFollowRequestHandler))),
	)
	apiMux.Handle(
		"POST /follow-requests/{requestID}/decline",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Followers.DeclineFollowRequestHandler))),
	)

	// =========================
	// Groups Routes
	// =========================

	apiMux.Handle(
		"GET /groups",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.ListGroupsHandler))),
	)
	apiMux.Handle(
		"POST /groups",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.CreateGroupHandler))),
	)
	apiMux.Handle(
		"GET /groups/mine",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetMyGroupsHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetGroupHandler))),
	)
	apiMux.Handle(
		"PUT /groups/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.UpdateGroupHandler))),
	)
	apiMux.Handle(
		"DELETE /groups/{id}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.DeleteGroupHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/members",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetGroupMembersHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/membership",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetMembershipHandler))),
	)
	apiMux.Handle(
		"DELETE /groups/{id}/members/{memberID}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.RemoveMemberHandler))),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.CreateJoinRequestHandler))),
	)
	apiMux.Handle(
		"DELETE /groups/{id}/join-requests",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.CancelJoinRequestHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/join-requests",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetPendingJoinRequestsHandler))),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests/{requestID}/accept",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.AcceptJoinRequestHandler))),
	)
	apiMux.Handle(
		"POST /groups/{id}/join-requests/{requestID}/reject",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.RejectJoinRequestHandler))),
	)
	apiMux.Handle(
		"POST /groups/{id}/invitations",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.CreateGroupInvitationHandler))),
	)
	apiMux.Handle(
		"GET /group-invitations",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetPendingInvitationsHandler))),
	)
	apiMux.Handle(
		"POST /group-invitations/{invitationID}/accept",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.AcceptGroupInvitationHandler))),
	)
	apiMux.Handle(
		"POST /group-invitations/{invitationID}/decline",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.DeclineGroupInvitationHandler))),
	)

	// =========================
	// Group Events Routes
	// =========================

	apiMux.Handle(
		"POST /groups/{id}/events",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.CreateEventHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/events",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetGroupEventsHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/events/{eventID}",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetEventHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/events/{eventID}/responses",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.GetEventResponsesHandler))),
	)
	apiMux.Handle(
		"PUT /groups/{id}/events/{eventID}/response",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Groups.RespondToEventHandler))),
	)

	// =========================
	// Group Posts Routes
	// =========================

	apiMux.Handle(
		"POST /groups/{id}/posts",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.NewGroupPostHandler))),
	)
	apiMux.Handle(
		"GET /groups/{id}/posts",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Posts.ListGroupPostsHandler))),
	)

	// =========================
	// Group Messages Routes
	// =========================

	apiMux.Handle(
		"GET /groups/{id}/messages",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Chat.GetGroupHistoryHandler))),
	)

	// =========================
	// Notifications Routes
	// =========================

	apiMux.Handle(
		"GET /notifications",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Notifications.ListNotificationsHandler))),
	)
	apiMux.Handle(
		"GET /notifications/unread-count",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Notifications.UnreadCountHandler))),
	)
	apiMux.Handle(
		"PATCH /notifications/read-all",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Notifications.MarkAllAsReadHandler))),
	)
	apiMux.Handle(
		"PATCH /notifications/{id}/read",
		sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Notifications.MarkAsReadHandler))),
	)

	// =========================
	// Search Routes
	// =========================

	apiMux.Handle(
		"GET /search",
		sessionMiddleware(http.HandlerFunc(deps.Handlers.Search.SearchHandler)),
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
