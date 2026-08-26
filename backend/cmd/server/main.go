package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"social/internal/auth"
	"social/internal/config"
	"social/internal/router"
	"social/internal/users"
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

func waitForShutdown(server *http.Server) {
	sigChan := make(chan os.Signal, 1)

	signal.Notify(
		sigChan,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	<-sigChan

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Println("shutdown error:", err)
	}

	log.Println("Server stopped.")
}

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
