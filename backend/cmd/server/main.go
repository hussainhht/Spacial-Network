package main

import (
	"errors"
	"log"
	"net/http"

	"social/internal/config"
	"social/internal/router"
	"social/pkg/db/sqlite"
)

func main() {
	cfg := config.Load()

	db, err := sqlite.Open(cfg.DBDir, cfg.DBFile)
	if err != nil {
		log.Fatal("database:", err)
	}
	defer db.Close()

	if err := sqlite.MigrateUp(db); err != nil {
		log.Fatal("migrations:", err)
	}

	authHandler, authService, err := setupAuth(db, cfg)
	if err != nil {
		log.Fatal("auth setup:", err)
	}

	if _, err := authService.CleanupSessions(); err != nil {
		log.Println("session cleanup:", err)
	}

	handler := router.NewRouter(
		authHandler,
		authService,
		cfg.SessionCookieName,
		cfg.UploadsDir,
	)

	server := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: handler,
	}

	go func() {
		log.Printf("Server running on http://localhost:%s", cfg.ServerPort)

		err := server.ListenAndServe()

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal("server:", err)
		}
	}()

	waitForShutdown(server)
}
