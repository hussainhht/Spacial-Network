package main

import (
	"log"
	"social/server"
)

func main() {
	const dbPath = "./social_network.db"

	// 1. Apply migrations
	// if err := dbsqlite.RunMigrations(dbPath); err != nil {
	// 	log.Fatal(err)
	// }

	// // 2. Open database
	// db, err := dbsqlite.Open(dbPath)
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// defer db.Close()

	// log.Println("database connected and migrations applied")
	if err := server.Init(); err != nil {
		log.Panicln(err)
		return
	}
}
