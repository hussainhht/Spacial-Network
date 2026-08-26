package main

import (
	"context"
	"errors"
	"log"
	"net"
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
	cfg := config.Load()

	db, err := sqlite.Open(cfg.DBDir, cfg.DBFile)
	if err != nil {
		log.Fatal("database not initialized:", err)
	}
	defer db.Close()

	if err := sqlite.MigrateUp(db); err != nil {
		log.Fatal("migrations not applied:", err)
	}

	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)

	authRepo := auth.NewRepository(db, cfg.SessionLifetime)
	authService := auth.NewService(authRepo, usersService)
	authHandler := auth.NewHandler(authService, usersService, cfg.SessionCookieName, cfg.CookieSecure, cfg.SessionLifetime)

	if _, err := authService.CleanupSessions(); err != nil {
		log.Println("session cleanup failed at startup:", err)
	}

	//* Start a background goroutine to clean up expired sessions periodically for every 24 hours.
	go func() {
		ticker := time.NewTicker(24 * time.Hour) // once a day
		defer ticker.Stop()
		for range ticker.C {
			if n, err := authService.CleanupSessions(); err != nil {
				log.Println("session cleanup error:", err)
			} else if n > 0 {
				log.Printf("cleaned %d old sessions", n)
			}
		}
	}()

	addr := net.JoinHostPort(cfg.ServerHost, cfg.ServerPort)

	server := &http.Server{
		Addr:    addr,
		Handler: router.New(authHandler, authService, cfg.SessionCookieName),
	}

	go func() {
		if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			log.Printf("HTTP server error: %v", err)
		}
		log.Println("Stopped serving new connections.")
	}()

	log.Printf("Server running on http://%s", addr)

	// Wait for termination signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal(err)
	}

	log.Println("Graceful shutdown complete.")
}
