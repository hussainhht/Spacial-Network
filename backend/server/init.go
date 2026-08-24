package server

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

	"social/db"
	"social/helpers"
)

var (
	Database *sql.DB
)

func Init() error {
	dbpointer, err := helpers.OpenOrCreateFile("db", "database.db")
	if err != nil {
		log.Fatal("Database not initialized:", err)
		return err
	}

	Database, err := db.InitDB(dbpointer)
	if err != nil {
		log.Fatal("Database not initialized:", err)
		return err
	}

	if err := db.InitSchema(Database); err != nil {
		log.Fatal("Schema not applied:", err)
		return err
	}

	// hub = ws.NewHub()
	// ws.SetDefaultHub(hub)
	// go hub.Run()

	// perform an initial purge of stale sessions and then schedule
	// regular cleanups to avoid unbounded growth of the table, we put it for 24h
	if _, err := db.CleanupSessions(); err != nil {
		log.Println("session cleanup failed at startup:", err)
	}
	go func() {
		ticker := time.NewTicker(24 * time.Hour) // once a day
		defer ticker.Stop()
		for range ticker.C {
			if n, err := db.CleanupSessions(); err != nil {
				log.Println("session cleanup error:", err)
			} else if n > 0 {
				log.Printf("cleaned %d old sessions", n)
			}
		}
	}()

	// go func() {
	// 	ticker := time.NewTicker(30 * time.Second)
	// 	defer ticker.Stop()
	// 	for range ticker.C {
	// 		if err := db.MarkInactiveUsersOffline(db.PresenceTimeout); err != nil {
	// 			log.Println("presence cleanup error:", err)
	// 		}
	// 	}
	// }()

	// go func() {
	// 	ticker := time.NewTicker(5 * time.Second)
	// 	defer ticker.Stop()
	// 	for range ticker.C {
	// 		posts, err := db.GetLastPosts()
	// 		if err != nil {
	// 			log.Println("post stats sync error:", err)
	// 			continue
	// 		}

	// 		for _, post := range posts {
	// 			ws.PublishPostStatsUpdate(post.ID)
	// 		}
	// 	}
	// }()

	addr := "localhost:8080"

	server := &http.Server{
		Addr:    addr,
		Handler: NewRouter(),
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
		return err
	}

	log.Println("Graceful shutdown complete.")
	return nil
}

