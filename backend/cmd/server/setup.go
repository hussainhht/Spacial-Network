package main

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/config"
	"social/internal/upload"
	"social/internal/users"
)

func setupAuth(db *sql.DB, cfg config.Config) (*auth.Handler, *auth.Service, error) {
	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)

	avatarStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, cfg.MaxAvatarSize)
	if err != nil {
		return nil, nil, err
	}

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

	return authHandler, authService, nil
}
