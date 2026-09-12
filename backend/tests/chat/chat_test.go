// Package chat_test covers social/internal/chat: direct messages are only
// permitted between two users where at least one follows the other,
// message persistence (sender/recipient/content/timestamp, emoji
// round-tripping), and the permission-check function the WebSocket handler
// relies on (HandlePrivateMessage). Real-time WebSocket delivery itself is
// out of scope for a unit test - see TEST_REPORT.md "Known gaps".
package chat_test

import (
	"database/sql"
	"strconv"
	"testing"

	"social/internal/chat"
	"social/internal/followers"
	"social/internal/notifications"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db           *sql.DB
	chatSvc      *chat.Service
	chatRepo     *chat.Repository
	followersSvc *followers.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo)

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo, nil)

	chatRepo := chat.NewRepository(db)
	hub := websocket.NewHub()
	chatSvc := chat.NewService(chatRepo, hub, notifSvc, followersSvc)

	return fixture{db: db, chatSvc: chatSvc, chatRepo: chatRepo, followersSvc: followersSvc}
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

func TestCanMessage_RequiresAFollowRelationship(t *testing.T) {
	f := setup(t)
	a := f.newUser(t, "chatA")
	b := f.newUser(t, "chatB")

	canMessage, err := f.followersSvc.CanMessage(a, b)
	if err != nil {
		t.Fatalf("CanMessage: %v", err)
	}
	if canMessage {
		t.Fatalf("two unconnected users must not be able to message each other")
	}

	if err := f.followersSvc.FollowUser(a, b); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	canMessage, err = f.followersSvc.CanMessage(a, b)
	if err != nil {
		t.Fatalf("CanMessage after follow: %v", err)
	}
	if !canMessage {
		t.Fatalf("expected messaging to be allowed once one user follows the other")
	}

	// The relationship is symmetric for messaging purposes: B can message A
	// too, even though B doesn't follow A.
	canMessageReverse, err := f.followersSvc.CanMessage(b, a)
	if err != nil {
		t.Fatalf("CanMessage(b, a): %v", err)
	}
	if !canMessageReverse {
		t.Fatalf("expected messaging to be allowed in the reverse direction too")
	}
}

func TestHandlePrivateMessage_RejectsNonConnectedUsers(t *testing.T) {
	f := setup(t)
	a := f.newUser(t, "chatC")
	b := f.newUser(t, "chatD")

	payload := []byte(`{"recipient_id":` + strconv.Itoa(b) + `,"content":"hello"}`)
	f.chatSvc.HandlePrivateMessage(int64(a), payload)

	history, err := f.chatRepo.GetPrivateHistory(int64(a), int64(b), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("expected no message to be persisted between non-connected users, got %d", len(history))
	}
}

func TestHandlePrivateMessage_PersistsMessageBetweenConnectedUsers(t *testing.T) {
	f := setup(t)
	a := f.newUser(t, "chatE")
	b := f.newUser(t, "chatF")

	if err := f.followersSvc.FollowUser(a, b); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	payload := []byte(`{"recipient_id":` + strconv.Itoa(b) + `,"content":"hello there"}`)
	f.chatSvc.HandlePrivateMessage(int64(a), payload)

	history, err := f.chatRepo.GetPrivateHistory(int64(a), int64(b), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 persisted message, got %d", len(history))
	}

	msg := history[0]
	if msg.SenderID != int64(a) {
		t.Errorf("SenderID = %d, want %d", msg.SenderID, a)
	}
	if msg.RecipientID != int64(b) {
		t.Errorf("RecipientID = %d, want %d", msg.RecipientID, b)
	}
	if msg.Content != "hello there" {
		t.Errorf("Content = %q, want %q", msg.Content, "hello there")
	}
	if msg.CreatedAt.IsZero() {
		t.Errorf("expected a non-zero CreatedAt timestamp")
	}
}

func TestSavePrivateMessage_EmojiRoundTrips(t *testing.T) {
	f := setup(t)
	a := f.newUser(t, "chatG")
	b := f.newUser(t, "chatH")

	const emojiContent = "Great news! 🎉🚀 Let's celebrate 🥳"

	saved, err := f.chatRepo.SavePrivateMessage(int64(a), int64(b), emojiContent)
	if err != nil {
		t.Fatalf("SavePrivateMessage: %v", err)
	}
	if saved.Content != emojiContent {
		t.Fatalf("saved content = %q, want %q", saved.Content, emojiContent)
	}

	history, err := f.chatRepo.GetPrivateHistory(int64(a), int64(b), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 1 || history[0].Content != emojiContent {
		t.Fatalf("expected emoji content to round-trip unchanged, got %+v", history)
	}
}

func TestHandlePrivateMessage_RejectsSelfMessage(t *testing.T) {
	f := setup(t)
	a := f.newUser(t, "chatI")

	payload := []byte(`{"recipient_id":` + strconv.Itoa(a) + `,"content":"talking to myself"}`)
	f.chatSvc.HandlePrivateMessage(int64(a), payload)

	history, err := f.chatRepo.GetPrivateHistory(int64(a), int64(a), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("expected no self-message to be persisted, got %d", len(history))
	}
}

