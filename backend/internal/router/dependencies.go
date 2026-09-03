package router

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/chat"
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

	// Future handlers:
	// TODO: Add Users handler when the users feature exposes one.
	// Users *users.Handler

	// TODO: Add Comments handler when the comments feature is implemented.
	// Comments *comments.Handler
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
	wsHandler.SetMessageHandler(chatService.HandleIncomingWSMessage)
	// =========================
	// Users
	// =========================

	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)

	// =========================
	// Uploads
	// =========================

	avatarStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, cfg.MaxAvatarSize)
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
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	// =========================
	// Comments - Future
	// =========================

	// TODO: Enable when the comments package is implemented.
	//
	// commentsRepo := comments.NewRepository(db)
	// commentsService := comments.NewService(commentsRepo)
	// commentsHandler := comments.NewHandler(commentsService)

	// =========================
	// Followers - Future
	// =========================

	// TODO: Enable when the followers package is implemented.
	//
	// followersRepo := followers.NewRepository(db)
	// followersService := followers.NewService(followersRepo)
	// followersHandler := followers.NewHandler(followersService)

	// =========================
	// Groups
	// =========================

	groupsRepo := groups.NewRepository(db)
	groupsService := groups.NewService(groupsRepo)
	groupsHandler := groups.NewHandler(groupsService)

	// =========================
	// Chat - Future
	// =========================

	// TODO: Enable when the chat package is implemented.
	//
	// chatRepo := chat.NewRepository(db)
	// chatService := chat.NewService(chatRepo)
	// chatHandler := chat.NewHandler(chatService)

	// =========================
	// Notifications
	// =========================
	// Persists notifications to SQLite and pushes them over the existing
	// websocket hub. Other features (Groups, and Followers once it exists)
	// depend only on notificationsService.Create(...) - never on this
	// package's repository or SQL.

	notificationsRepo := notifications.NewRepository(db)
	notificationsSender := notifications.NewHubSender(hub)
	notificationsService := notifications.NewService(notificationsRepo, notificationsSender)
	notificationsHandler := notifications.NewHandler(notificationsService)

	return &Dependencies{
		Handlers: Handlers{
			Auth:      authHandler,
			Chat:      chatHandler,
			Websocket: wsHandler, Groups: groupsHandler,

			Posts:         postsHandler,
			Notifications: notificationsHandler,
			// Comments:      commentsHandler,
			// Followers:     followersHandler,
		},
		AuthService:          authService,
		GroupsService:        groupsService,
		NotificationsService: notificationsService,

		// PostsService: postsService,
	}, nil
}
