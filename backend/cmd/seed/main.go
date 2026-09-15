package main

import (
	"flag"
	"fmt"
	"log"

	"social/internal/config"
	"social/internal/seed"
	"social/pkg/db/sqlite"
)

func main() {
	cleanFlag := flag.Bool("clean", true, "Truncate existing table data before seeding (starts IDs from 1)")
	flag.Parse()

	log.Println("🚀 Initializing database seeder...")

	cfg := config.Load()

	db, err := sqlite.Open(cfg.DBDir, cfg.DBFile)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}
	defer db.Close()

	// Ensure all migrations are applied prior to seeding
	log.Println("📦 Checking and running database migrations...")
	if err := sqlite.MigrateUp(db); err != nil {
		log.Fatalf("❌ Failed to run migrations: %v", err)
	}

	opts := seed.SeedOptions{
		Clean: *cleanFlag,
	}

	if err := seed.Run(db, opts); err != nil {
		log.Fatalf("❌ Seeding failed: %v", err)
	}

	printSummary()
}

func printSummary() {
	fmt.Println()
	fmt.Println("==================================================================")
	fmt.Println("🌟 Database Seeding Complete! Sample Credentials:")
	fmt.Println("==================================================================")
	fmt.Println("All accounts share the password: Password123!")
	fmt.Println()
	fmt.Println(" • alice     (alice@space.net)       - Public Astrophysicist")
	fmt.Println(" • bob       (bob@quantum.io)        - Public Quantum Engineer")
	fmt.Println(" • charlie   (charlie@astro-lens.org) - Private Astrophotographer")
	fmt.Println(" • diana     (diana@bio-cosmos.net)  - Public Astro-botanist")
	fmt.Println(" • elena     (elena@geoplanet.org)   - Public Planetary Geologist")
	fmt.Println(" • frank     (frank@zero-g.space)    - Private Habitat Architect")
	fmt.Println(" • grace     (grace@deeprelay.com)   - Public Signal Engineer")
	fmt.Println(" • cosmonaut (cosmonaut@social.local) - Public Community Explorer")
	fmt.Println()
	fmt.Println("What was populated:")
	fmt.Println(" ✔ 8 Users with bios, nicknames, and birthdays")
	fmt.Println(" ✔ Mutual followers & pending follow requests (private accounts)")
	fmt.Println(" ✔ 5 Space-themed Groups (4 Public, 1 Private) & memberships")
	fmt.Println(" ✔ Group join requests and pending invitations")
	fmt.Println(" ✔ 4 Upcoming Group Events with RSVPs (going / not going)")
	fmt.Println(" ✔ 11 Feed and Group Posts (public, followers-only, custom visibility)")
	fmt.Println(" ✔ 12 Comments on posts")
	fmt.Println(" ✔ Direct message threads between mutual followers (Alice, Bob, etc.)")
	fmt.Println(" ✔ Group channel chat messages")
	fmt.Println(" ✔ Real user notifications")
	fmt.Println("==================================================================")
	fmt.Println()
}
