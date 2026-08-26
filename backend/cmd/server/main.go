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
	// 1. Load config
	cfg := config.Load()

	// 2. Open database
	db, err := sqlite.Open(cfg.DBDir, cfg.DBFile)
	if err != nil {
		log.Fatal("database:", err)
	}
	defer db.Close()

	// 3. Run migrations
	if err := sqlite.MigrateUp(db); err != nil {
		log.Fatal("migrations:", err)
	}

	// 4. Setup auth handler and service
	authHandler, authService := setupAuth(db, cfg)

	// 5. Remove expired sessions at startup
	if _, err := authService.CleanupSessions(); err != nil {
		log.Println("session cleanup:", err)
	}

	// 6. Create router
	handler := router.NewRouter(
		authHandler,
		authService,
		cfg.SessionCookieName,
	)

	// 7. Create HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: handler,
	}

	// 8. Start server
	go func() {
		log.Printf("Server running on http://localhost:%s", cfg.ServerPort)

		err := server.ListenAndServe()

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal("server:", err)
		}
	}()

	// 9. Wait until Ctrl+C
	waitForShutdown(server)
}
