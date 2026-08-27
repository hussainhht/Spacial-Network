package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"social/internal/config"
	"social/pkg/db/sqlite"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: go run ./cmd/migrate [up|down|down-all|version|create <name>]")
		return
	}

	command := os.Args[1]

	if command == "create" {
		if len(os.Args) < 3 {
			fmt.Println("usage: go run ./cmd/migrate create <migration_name>")
			return
		}
		name := os.Args[2]
		timestamp := time.Now().UTC().Format("20060102150405")
		dir := "pkg/db/migrations/sqlite"

		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatal("create migrations dir:", err)
		}

		upPath := fmt.Sprintf("%s/%s_%s.up.sql", dir, timestamp, name)
		downPath := fmt.Sprintf("%s/%s_%s.down.sql", dir, timestamp, name)

		upTemplate := fmt.Sprintf("PRAGMA foreign_keys = ON;\n\n-- %s migration up\n", name)
		downTemplate := fmt.Sprintf("-- %s migration down\n", name)

		if err := os.WriteFile(upPath, []byte(upTemplate), 0644); err != nil {
			log.Fatal("write up migration:", err)
		}
		if err := os.WriteFile(downPath, []byte(downTemplate), 0644); err != nil {
			log.Fatal("write down migration:", err)
		}

		fmt.Printf("Created migration:\n  %s\n  %s\n", upPath, downPath)
		return
	}

	cfg := config.Load()
	db, err := sqlite.Open(cfg.DBDir, cfg.DBFile)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	switch command {
	case "up":
		err = sqlite.MigrateUp(db)

	case "down":
		err = sqlite.MigrateDown(db)

	case "down-all":
		err = sqlite.MigrateDownAll(db)

	case "version":
		var version int64
		version, err = sqlite.MigrationVersion(db)
		if err == nil {
			fmt.Println("Migration version:", version)
		}

	default:
		fmt.Println("unknown migration command:", command)
		fmt.Println("usage: go run ./cmd/migrate [up|down|down-all|version|create <name>]")
		return
	}

	if err != nil {
		log.Fatal(err)
	}
}
