package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"social/internal/auth"
	"social/internal/middleware"
	"social/pkg/db/sqlite"
)

const (
	dbDir       = "data"
	dbFileName  = "social-network.db"
	indexPath   = "web/public/index.html"
	srcDir      = "web/src"
	faviconPath = "web/src/static/icons/favicon.ico"
	iconPath    = "web/src/static/icons/general.png"
)

func main() {
	db, err := sqlite.Open(dbDir, dbFileName)
	if err != nil {
		log.Fatal("database not initialized:", err)
	}
	defer db.Close()

	if err := sqlite.RunMigrations(db); err != nil {
		log.Fatal("migrations not applied:", err)
	}

	// perform an initial purge of stale sessions and then schedule regular
	// cleanups to avoid unbounded growth of the table
	if _, err := auth.CleanupSessions(); err != nil {
		log.Println("session cleanup failed at startup:", err)
	}
	go func() {
		ticker := time.NewTicker(24 * time.Hour) // once a day
		defer ticker.Stop()
		for range ticker.C {
			if n, err := auth.CleanupSessions(); err != nil {
				log.Println("session cleanup error:", err)
			} else if n > 0 {
				log.Printf("cleaned %d old sessions", n)
			}
		}
	}()

	addr := "localhost:8080"

	server := &http.Server{
		Addr:    addr,
		Handler: newRouter(),
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

func newRouter() http.Handler {
	mux := http.NewServeMux()

	// Home
	mux.HandleFunc("/", handleHome)

	// Static assets
	mux.Handle("/src/", http.StripPrefix("/src/", http.FileServer(http.Dir(srcDir))))
	mux.HandleFunc("/favicon.ico", handleFavicon)
	mux.HandleFunc("/static/icons/general.png", handleGeneralIcon)

	// Public routes
	mux.HandleFunc("/login", auth.LoginHandler)
	mux.HandleFunc("/register", auth.RegisterHandler)

	// Protected API sub-router
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/logout", auth.LogoutHandler)

	// Apply middleware ONLY to API
	protectedAPI := middleware.SessionMiddleware()(apiMux)

	// Mount under /api/
	mux.Handle("/api/", http.StripPrefix("/api", protectedAPI))

	return mux
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, indexPath)
}

func handleFavicon(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, faviconPath)
}

func handleGeneralIcon(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, iconPath)
}
