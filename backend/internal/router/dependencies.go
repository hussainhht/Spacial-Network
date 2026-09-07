package router

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/chat"
	"social/internal/comments"
	"social/internal/config"
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

	// TODO: Add Followers handler when the followers feature is implemented.
	// Followers *followers.Handler
	// TODO: Add Chat handler when the chat feature is implemented.
	// Chat *chat.Handler
}

type Dependencies struct {
	Handlers Handlers

	AuthService          *auth.Service
	GroupsService        *groups.Service
	NotificationsService *notifications.Service

	// Future shared services:
	PostsService *posts.Service
	// GroupsService        *groups.Service
	// PostsService         *posts.Service
}

func setupDependencies(db *sql.DB, cfg config.Config) (*Dependencies, error) {
	hub := websocket.NewHub()
	chatRepo := chat.NewRepository(db)
	chatService := chat.NewService(chatRepo, hub)
	chatHandler := chat.NewHandler(chatService)
	wsHandler := websocket.NewHandler(hub)
	// Message routing is finished further down, once every feature that
	// handles inbound WebSocket events (chat, groups) has been constructed.
	// =========================
	// Users
	// =========================

	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)
	usersHandler := users.NewHandler(usersService)

	// =========================
	// Uploads
	// =========================

	avatarStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, cfg.MaxAvatarSize)
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
	// Posts
	// =========================

	postsRepo := posts.NewRepository(db)
	postsService := posts.NewService(postsRepo)
	postsHandler := posts.NewHandler(
		postsService,
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
	// Followers - Future
	// =========================

	// TODO: Enable when the followers package is implemented.
	//
	// followersRepo := followers.NewRepository(db)
	// followersService := followers.NewService(followersRepo)
	// followersHandler := followers.NewHandler(followersService)

	// =========================
	// Notifications
	// =========================
	// Persists notifications to SQLite and pushes them over the existing
	// websocket hub. Other features (Groups, and Followers once it exists)
	// depend on notificationsService only through their own generic
	// NotificationSender interface (Notify(...)) - never on this package's
	// repository or SQL.

	notificationsRepo := notifications.NewRepository(db)
	notificationsSender := notifications.NewHubSender(hub)
	notificationsService := notifications.NewService(notificationsRepo, notificationsSender)
	notificationsHandler := notifications.NewHandler(notificationsService)

	// =========================
	// Groups
	// =========================

	groupsRepo := groups.NewRepository(db)
	groupsService := groups.NewService(groupsRepo, notificationsService)
	groupsHandler := groups.NewHandler(groupsService)
	inviteSearchWSHandler := groups.NewInviteSearchWSHandler(groupsService, hub)

	// =========================
	// Chat - Future
	// =========================

	// TODO: Enable when the chat package is implemented.
	//
	// chatRepo := chat.NewRepository(db)
	// chatService := chat.NewService(chatRepo)
	// chatHandler := chat.NewHandler(chatService)

	// =========================
	// WebSocket message routing
	// =========================
	// Both Chat and Groups handle inbound client messages; Router dispatches
	// each by its event type to whichever feature registered it, so the Hub
	// stays a single connection per user regardless of how many features
	// use it.

	wsRouter := websocket.NewRouter()
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
			// Followers:     followersHandler,
		},
		AuthService:          authService,
		GroupsService:        groupsService,
		NotificationsService: notificationsService,

		// PostsService: postsService,
	}, nil
}
