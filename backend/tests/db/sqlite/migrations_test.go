// Package sqlite_test covers social/pkg/db/sqlite: applying every
// migration to a fresh database, idempotency of re-running MigrateUp, and
// that the resulting schema has the tables the rest of the test suite
// relies on.
package sqlite_test

import (
	"database/sql"
	"testing"

	"social/pkg/db/sqlite"
)

func openMemoryDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", "file::memory:?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	return db
}

func TestMigrateUp_AppliesAllMigrations(t *testing.T) {
	db := openMemoryDB(t)

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("MigrateUp: %v", err)
	}

	version, err := sqlite.MigrationVersion(db)
	if err != nil {
		t.Fatalf("MigrationVersion: %v", err)
	}
	if version == 0 {
		t.Fatalf("expected a non-zero migration version after MigrateUp")
	}

	wantTables := []string{
		"users", "sessions", "private_messages", "groups", "group_members",
		"posts", "notifications", "group_invitations", "group_join_requests",
		"comments", "followers", "events", "event_responses", "follow_requests",
		"post_allowed_viewers",
		"post_media",
		"user_blocks", "user_mutes",
	}
	for _, table := range wantTables {
		var name string
		err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, table).Scan(&name)
		if err != nil {
			t.Errorf("expected table %q to exist after migrations: %v", table, err)
		}
	}
}

func TestMigrateUp_IsIdempotent(t *testing.T) {
	db := openMemoryDB(t)

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("first MigrateUp: %v", err)
	}
	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("second MigrateUp (should be a no-op) failed: %v", err)
	}
}

func TestPostMediaMigration_BackfillsLegacyImagePath(t *testing.T) {
	db := openMemoryDB(t)
	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("MigrateUp: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("remove safety-preferences migration: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("remove post-media migration: %v", err)
	}

	userResult, err := db.Exec(`
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash)
		VALUES ('media-user', 'mediauser', 25, 'male', 'Media', 'User', 'media@example.com', 'hash')
	`)
	if err != nil {
		t.Fatal(err)
	}
	userID, _ := userResult.LastInsertId()
	postResult, err := db.Exec(`
		INSERT INTO posts (user_id, visibility, title, content, image_path)
		VALUES (?, 'public', 'Legacy', 'Has an image', 'posts/legacy.gif')
	`, userID)
	if err != nil {
		t.Fatal(err)
	}
	postID, _ := postResult.LastInsertId()

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("reapply post-media migration: %v", err)
	}
	var path, mediaType string
	var order int
	if err := db.QueryRow(`SELECT file_path, media_type, sort_order FROM post_media WHERE post_id = ?`, postID).Scan(&path, &mediaType, &order); err != nil {
		t.Fatal(err)
	}
	if path != "posts/legacy.gif" || mediaType != "gif" || order != 0 {
		t.Fatalf("backfill = (%q, %q, %d)", path, mediaType, order)
	}
}

func TestGroupPrivacyMigration_BackfillsLegacyGroupsAsPublicAndPreservesMembership(t *testing.T) {
	db := openMemoryDB(t)

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("initial MigrateUp: %v", err)
	}
	// Roll back the newer safety-preferences and post-media migrations, then
	// the privacy migration, to reproduce a group that existed before the
	// privacy column was introduced.
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("MigrateDown safety-preferences migration: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("MigrateDown post-media migration: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("MigrateDown privacy migration: %v", err)
	}

	result, err := db.Exec(`
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash)
		VALUES ('legacy-user', 'legacyuser', 25, 'male', 'Legacy', 'User', 'legacy@example.com', 'hash')
	`)
	if err != nil {
		t.Fatalf("insert legacy user: %v", err)
	}
	creatorID, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("legacy user id: %v", err)
	}
	groupResult, err := db.Exec(
		`INSERT INTO groups (creator_id, title, description) VALUES (?, 'Legacy Group', '')`,
		creatorID,
	)
	if err != nil {
		t.Fatalf("insert group before privacy migration: %v", err)
	}
	groupID, err := groupResult.LastInsertId()
	if err != nil {
		t.Fatalf("legacy group id: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'creator')`,
		groupID,
		creatorID,
	); err != nil {
		t.Fatalf("insert legacy membership: %v", err)
	}

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("re-apply privacy migration: %v", err)
	}
	var privacy string
	if err := db.QueryRow(`SELECT privacy FROM groups WHERE title = 'Legacy Group'`).Scan(&privacy); err != nil {
		t.Fatalf("read backfilled privacy: %v", err)
	}
	if privacy != "public" {
		t.Fatalf("backfilled legacy privacy = %q, want public", privacy)
	}
	var membershipCount int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?`,
		groupID,
		creatorID,
	).Scan(&membershipCount); err != nil {
		t.Fatalf("read preserved legacy membership: %v", err)
	}
	if membershipCount != 1 {
		t.Fatalf("legacy membership count = %d, want 1", membershipCount)
	}

	// Direct inserts and legacy clients that omit privacy keep the historical
	// discoverable + approval-required behavior.
	if _, err := db.Exec(
		`INSERT INTO groups (creator_id, title, description) VALUES (?, 'Default Public Group', '')`,
		creatorID,
	); err != nil {
		t.Fatalf("insert group with public default: %v", err)
	}
	if err := db.QueryRow(`SELECT privacy FROM groups WHERE title = 'Default Public Group'`).Scan(&privacy); err != nil {
		t.Fatalf("read public default: %v", err)
	}
	if privacy != "public" {
		t.Fatalf("default privacy = %q, want public", privacy)
	}

	if _, err := db.Exec(
		`INSERT INTO groups (creator_id, title, description, privacy) VALUES (?, 'Explicit Private Group', '', 'private')`,
		creatorID,
	); err != nil {
		t.Fatalf("insert explicit private group: %v", err)
	}
	if _, err := db.Exec(`UPDATE groups SET privacy = 'hidden' WHERE title = 'Legacy Group'`); err == nil {
		t.Fatal("expected privacy CHECK constraint to reject hidden")
	}

	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("final MigrateDown safety-preferences migration: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("final MigrateDown post-media migration: %v", err)
	}
	if err := sqlite.MigrateDown(db); err != nil {
		t.Fatalf("final MigrateDown privacy migration: %v", err)
	}
	if err := db.QueryRow(`SELECT privacy FROM groups LIMIT 1`).Scan(&privacy); err == nil {
		t.Fatal("privacy column still exists after down migration")
	}
}

func TestMigrateDownAll_RemovesTables(t *testing.T) {
	db := openMemoryDB(t)

	if err := sqlite.MigrateUp(db); err != nil {
		t.Fatalf("MigrateUp: %v", err)
	}
	if err := sqlite.MigrateDownAll(db); err != nil {
		t.Fatalf("MigrateDownAll: %v", err)
	}

	version, err := sqlite.MigrationVersion(db)
	if err != nil {
		t.Fatalf("MigrationVersion: %v", err)
	}
	if version != 0 {
		t.Errorf("expected migration version 0 after MigrateDownAll, got %d", version)
	}

	var name string
	err = db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'users'`).Scan(&name)
	if err != sql.ErrNoRows {
		t.Errorf("expected the users table to be gone after MigrateDownAll, got err=%v", err)
	}
}
