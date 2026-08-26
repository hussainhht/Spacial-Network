package main

import (
	"fmt"
	"log"
	"os"

	"social/pkg/db/sqlite"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: go run ./cmd/migrate [up|down|down-all|version]")
		return
	}

	db, err := sqlite.Open("data", "social.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	command := os.Args[1]

	switch command {
	case "up":
		err = sqlite.MigrateUp(db)

	case "down":
		err = sqlite.MigrateDown(db)

	case "down-all":
		err = sqlite.MigrateDownAll(db)

	case "version":
		var version int

		version, err = sqlite.MigrationVersion(db)
		if err == nil {
			fmt.Println("Migration version:", version)
		}

	default:
		fmt.Println("unknown migration command:", command)
		fmt.Println("usage: go run ./cmd/migrate [up|down|down-all|version]")
		return
	}

	if err != nil {
		log.Fatal(err)
	}
}
