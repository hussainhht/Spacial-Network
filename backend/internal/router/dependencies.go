package router

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/config"
	"social/internal/groups"
	"social/internal/upload"
	"social/internal/users"
)

type Handlers struct {
	Auth   *auth.Handler
	Groups *groups.Handler

	// Future handlers:
	// TODO: Add Users handler when the users feature exposes one.
	// Users *users.Handler
	// TODO: Add Posts handler when the posts feature is implemented.
	// Posts *posts.Handler
	// TODO: Add Comments handler when the comments feature is implemented.
	// Comments *comments.Handler
	// TODO: Add Followers handler when the followers feature is implemented.
	// Followers *followers.Handler
	// TODO: Add Chat handler when the chat feature is implemented.
	// Chat *chat.Handler
	// TODO: Add Notifications handler when the notifications feature is implemented.
	// Notifications *notifications.Handler
}

type Dependencies struct {
	Handlers Handlers

	AuthService   *auth.Service
	GroupsService *groups.Service

	// Future shared services:
	// PostsService         *posts.Service
	// NotificationsService *notifications.Service
}

func setupDependencies(db *sql.DB, cfg config.Config) (*Dependencies, error) {
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
	// Posts - Future
	// =========================

	// TODO: Enable when the posts package is implemented.
	//
	// postsRepo := posts.NewRepository(db)
	// postsService := posts.NewService(postsRepo)
	// postsHandler := posts.NewHandler(postsService)

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
	// Notifications - Future
	// =========================

	// TODO: Enable when the notifications package is implemented.
	//
	// notificationsRepo := notifications.NewRepository(db)
	// notificationsService := notifications.NewService(notificationsRepo)
	// notificationsHandler := notifications.NewHandler(notificationsService)

	return &Dependencies{
		Handlers: Handlers{
			Auth:   authHandler,
			Groups: groupsHandler,

			// Posts:         postsHandler,
			// Comments:      commentsHandler,
			// Followers:     followersHandler,
			// Chat:          chatHandler,
			// Notifications: notificationsHandler,
		},
		AuthService:   authService,
		GroupsService: groupsService,

		// PostsService:         postsService,
		// NotificationsService: notificationsService,
	}, nil
}
