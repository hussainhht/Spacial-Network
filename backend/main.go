package main

import (
    "log"
    "net/http"

    dbsqlite "social/pkg/db/sqlite"
)

func main() {
    const dbPath = "./data/social-network.db"

    if err := dbsqlite.RunMigrations(dbPath); err != nil {
        log.Fatal(err)
    }

    db, err := dbsqlite.Open(dbPath)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    mux := http.NewServeMux()

    mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"status":"ok"}`))
    })

    log.Println("server running on http://localhost:8080")

    if err := http.ListenAndServe(":8080", mux); err != nil {
        log.Fatal(err)
    }
}