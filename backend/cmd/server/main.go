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

	handler, err := router.NewRouter(db, cfg)
	if err != nil {
		log.Fatal("router:", err)
	}

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
