package main

import (
	"log"

	dbsqlite "social/pkg/db/sqlite"
)

func main() {
	const dbPath = "./social_network.db"

	// 1. Apply migrations
	if err := dbsqlite.RunMigrations(dbPath); err != nil {
		log.Fatal(err)
	}

	// 2. Open database
	db, err := dbsqlite.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	log.Println("database connected and migrations applied")

	// Start HTTP server later...
}
