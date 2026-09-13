package router

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/chat"
	"social/internal/comments"
	"social/internal/config"
	"social/internal/followers"
	"social/internal/groups"
	"social/internal/notifications"
	"social/internal/posts"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
)

type Handlers struct {
	Auth          *auth.Handler
	Posts         *posts.Handler
	Chat          *chat.Handler
	Websocket     *websocket.Handler
	Groups        *groups.Handler
	Notifications *notifications.Handler
	Users         *users.Handler
	Comments      *comments.Handler
	Followers     *followers.Handler

	// TODO: Add Chat handler when the chat feature is implemented.
	// Chat *chat.Handler
}

type Dependencies struct {
	Handlers Handlers

	AuthService          *auth.Service
	GroupsService        *groups.Service
	NotificationsService *notifications.Service
	FollowersService     *followers.Service

	// Future shared services:
	PostsService *posts.Service
	// GroupsService        *groups.Service
	// PostsService         *posts.Service
}

func setupDependencies(db *sql.DB, cfg config.Config) (*Dependencies, error) {
	hub := websocket.NewHub()
	wsHandler := websocket.NewHandler(hub)

	// =========================
	// Notifications
	// =========================
	// Persists notifications to SQLite and pushes them over the existing
	// websocket hub. Other features (Chat, Groups, and Followers once it exists)
	// depend on notificationsService only through their own generic
	// NotificationSender interface (Notify(...)) - never on this package's
	// repository or SQL.

	notificationsRepo := notifications.NewRepository(db)
	notificationsSender := notifications.NewHubSender(hub)
	notificationsService := notifications.NewService(notificationsRepo, notificationsSender)
	notificationsHandler := notifications.NewHandler(notificationsService)

	// =========================
	// Followers
	// =========================

	followersRepo := followers.NewRepository(db)
	followersService := followers.NewService(followersRepo)

	// =========================
	// Users
	// =========================

	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo, followersService)
	usersHandler := users.NewHandler(usersService)

	followersHandler := followers.NewHandler(followersService, usersService)

	// =========================
	// Uploads
	// =========================

	avatarStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, upload.AvatarSubdir, cfg.MaxAvatarSize)
	if err != nil {
		return nil, err
	}

	groupPhotoStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, upload.GroupPhotoSubdir, cfg.MaxAvatarSize)
	if err != nil {
		return nil, err
	}

	postMediaStorage, err := upload.NewMediaStorage(cfg.UploadsDir, upload.PostsSubdir, cfg.MaxMediaSize)
	if err != nil {
		return nil, err
	}

	commentMediaStorage, err := upload.NewMediaStorage(cfg.UploadsDir, upload.CommentsSubdir, cfg.MaxMediaSize)
	if err != nil {
		return nil, err
	}

	// =========================
	// Authentication
	// =========================

	authRepo := auth.NewRepository(db, cfg.SessionLifetime)
	authService := auth.NewService(authRepo, usersService)
	authHandler := auth.NewHandler(
		authService,
		usersService,
		avatarStorage,
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	// =========================
	// Groups
	// =========================
	// Constructed before Posts/Comments/Chat, which depend on groupsService for
	// group-membership checks on group-scoped posts, comments, and messages.

	groupsRepo := groups.NewRepository(db)
	groupsService := groups.NewService(groupsRepo, notificationsService, hub)
	groupsHandler := groups.NewHandler(groupsService, groupPhotoStorage)
	inviteSearchWSHandler := groups.NewInviteSearchWSHandler(groupsService, hub)

	// =========================
	// Chat
	// =========================

	chatRepo := chat.NewRepository(db)
	chatService := chat.NewService(chatRepo, hub, notificationsService, followersService, groupsService)
	chatHandler := chat.NewHandler(chatService)

	// =========================
	// Posts
	// =========================

	postsRepo := posts.NewRepository(db)
	postsService := posts.NewService(postsRepo, followersService, groupsService)
	postsHandler := posts.NewHandler(
		postsService,
		usersService,
		groupsService,
		postMediaStorage,
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	// =========================
	// Comments
	// =========================

	commentsRepo := comments.NewRepository(db)
	commentsService := comments.NewService(commentsRepo, postsService)
	commentsHandler := comments.NewHandler(commentsService, commentMediaStorage)

	// =========================
	// WebSocket message routing
	// =========================
	// Both Chat and Groups handle inbound client messages; Router dispatches
	// each by its event type to whichever feature registered it, so the Hub
	// stays a single connection per user regardless of how many features
	// use it.

	wsRouter := websocket.NewRouter()
	chatService.RegisterWSRoutes(wsRouter)
	wsRouter.Register(groups.EventInviteUserSearch, inviteSearchWSHandler.HandleInviteUserSearch)
	wsHandler.SetMessageHandler(wsRouter.Dispatch)

	return &Dependencies{
		Handlers: Handlers{
			Auth:          authHandler,
			Chat:          chatHandler,
			Websocket:     wsHandler,
			Groups:        groupsHandler,
			Posts:         postsHandler,
			Notifications: notificationsHandler,
			Users:         usersHandler,
			Comments:      commentsHandler,
			Followers:     followersHandler,
		},
		AuthService:          authService,
		GroupsService:        groupsService,
		NotificationsService: notificationsService,
		FollowersService:     followersService,

		// PostsService: postsService,
	}, nil
}
