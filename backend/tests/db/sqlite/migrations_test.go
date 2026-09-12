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
