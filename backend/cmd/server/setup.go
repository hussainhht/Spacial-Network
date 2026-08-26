package main

import (
	"database/sql"

	"social/internal/auth"
	"social/internal/config"
	"social/internal/users"
)

func setupAuth(db *sql.DB, cfg config.Config) (*auth.Handler, *auth.Service) {
	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)

	authRepo := auth.NewRepository(db, cfg.SessionLifetime)
	authService := auth.NewService(authRepo, usersService)

	authHandler := auth.NewHandler(
		authService,
		usersService,
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	return authHandler, authService
}
