// Package testutil provides shared helpers for spinning up an isolated,
// fully-migrated in-memory SQLite database (and seeding test users into it)
// for use across the backend test suite.
package testutil

import (
	"database/sql"
	"testing"

	"social/internal/users"
	"social/pkg/db/sqlite"

	"github.com/google/uuid"
)

// NewTestDB opens a fresh in-memory SQLite database, applies every
// migration to it, and registers cleanup to close it when the test (or
// subtest) finishes. Each call gets its own isolated database - nothing is
// shared between tests.
func NewTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", "file::memory:?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	// A ":memory:" database only exists for the lifetime of one connection,
	// so force the pool to reuse a single connection for the whole test.
	db.SetMaxOpenConns(1)

	if err := sqlite.MigrateUp(db); err != nil {
		db.Close()
		t.Fatalf("migrate up: %v", err)
	}

	t.Cleanup(func() { db.Close() })

	return db
}

// NewUserOpts customizes a seeded test user; the zero value is a sensible
// default public profile.
type NewUserOpts struct {
	Username  string
	Email     string
	Password  string
	FirstName string
	LastName  string
	Age       int
	Gender    string
	IsPrivate bool
}

// CreateUser seeds a new user directly through the users package (so the
// password is hashed exactly like production) and returns its ID.
func CreateUser(t *testing.T, db *sql.DB, opts NewUserOpts) int {
	t.Helper()

	if opts.Password == "" {
		opts.Password = "correct-horse-battery-staple"
	}
	if opts.FirstName == "" {
		opts.FirstName = "Test"
	}
	if opts.LastName == "" {
		opts.LastName = "User"
	}
	if opts.Age == 0 {
		opts.Age = 25
	}
	if opts.Gender == "" {
		opts.Gender = "male"
	}

	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	if err := svc.CreateUser(
		uuid.NewString(),
		opts.Username,
		opts.Age,
		opts.Gender,
		opts.FirstName,
		opts.LastName,
		opts.Email,
		opts.Password,
		"",
	); err != nil {
		t.Fatalf("seed user %q: %v", opts.Username, err)
	}

	id, err := repo.GetUserIDByUsername(opts.Username)
	if err != nil {
		t.Fatalf("look up seeded user %q: %v", opts.Username, err)
	}

	if opts.IsPrivate {
		if err := repo.UpdateProfilePrivacy(id, true); err != nil {
			t.Fatalf("set user %q private: %v", opts.Username, err)
		}
	}

	return id
}
