package followers

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:?_foreign_keys=on")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	createTables := `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		first_name TEXT NOT NULL,
		last_name TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		date_of_birth DATE NOT NULL DEFAULT '2000-01-01',
		profile_photo TEXT
	);

	CREATE TABLE followers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		follower_id INTEGER NOT NULL,
		followed_id INTEGER NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE (follower_id, followed_id)
	);
	`
	if _, err := db.Exec(createTables); err != nil {
		t.Fatalf("failed to create tables: %v", err)
	}

	// Seed 3 users
	_, err = db.Exec(`
		INSERT INTO users (id, username, email, first_name, last_name, password_hash)
		VALUES 
		(1, 'alice', 'alice@test.com', 'Alice', 'Smith', 'hash'),
		(2, 'bob', 'bob@test.com', 'Bob', 'Jones', 'hash'),
		(3, 'carol', 'carol@test.com', 'Carol', 'White', 'hash');
	`)
	if err != nil {
		t.Fatalf("failed to seed users: %v", err)
	}

	return db
}

func TestFollowAndCanMessage(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	service := NewService(repo)

	// Initially, Alice and Bob don't follow each other
	canMsg, err := service.CanMessage(1, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if canMsg {
		t.Errorf("expected CanMessage to be false, got true")
	}

	// Self-message check
	canMsgSelf, err := service.CanMessage(1, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if canMsgSelf {
		t.Errorf("expected CanMessage to self to be false, got true")
	}

	// Alice follows Bob
	if err := service.FollowUser(1, 2); err != nil {
		t.Fatalf("failed to follow: %v", err)
	}

	// Alice -> Bob should be true
	canMsgAB, err := service.CanMessage(1, 2)
	if err != nil || !canMsgAB {
		t.Errorf("expected Alice can message Bob, got %v (err: %v)", canMsgAB, err)
	}

	// Bob -> Alice should ALSO be true (because Alice follows Bob)
	canMsgBA, err := service.CanMessage(2, 1)
	if err != nil || !canMsgBA {
		t.Errorf("expected Bob can message Alice, got %v (err: %v)", canMsgBA, err)
	}

	// Alice and Carol don't follow each other
	canMsgAC, err := service.CanMessage(1, 3)
	if err != nil || canMsgAC {
		t.Errorf("expected Alice cannot message Carol, got %v", canMsgAC)
	}

	// Check EligibleChatContacts for Alice (should include Bob, but not Carol or herself)
	contacts, err := service.GetEligibleChatContacts(1)
	if err != nil {
		t.Fatalf("failed to get contacts: %v", err)
	}
	if len(contacts) != 1 {
		t.Fatalf("expected 1 contact, got %d", len(contacts))
	}
	if contacts[0].ID != 2 || contacts[0].Username != "bob" {
		t.Errorf("expected Bob in contacts, got %+v", contacts[0])
	}

	// Check EligibleChatContacts for Bob (should include Alice, who follows him)
	bobContacts, err := service.GetEligibleChatContacts(2)
	if err != nil {
		t.Fatalf("failed to get contacts for Bob: %v", err)
	}
	if len(bobContacts) != 1 {
		t.Fatalf("expected 1 contact for Bob, got %d", len(bobContacts))
	}
	if bobContacts[0].ID != 1 || bobContacts[0].Username != "alice" {
		t.Errorf("expected Alice in Bob's contacts, got %+v", bobContacts[0])
	}
}
