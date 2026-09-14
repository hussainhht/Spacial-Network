// Package notifications_test covers social/internal/notifications directly
// (creation, unread count, mark-as-read, per-recipient scoping) and, via
// social/internal/groups, that a group invitation and a group join request
// actually generate a notification for the right recipient. A follow
// request notification is NOT covered here on purpose - see
// TEST_REPORT.md "Bugs found": social/internal/followers.Service is never
// wired to a notifier, so no follow-request notification is ever created
// today, despite NotificationFollowRequest existing as a type.
package notifications_test

import (
	"database/sql"
	"testing"
	"time"

	"social/internal/groups"
	"social/internal/notifications"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db        *sql.DB
	notifSvc  *notifications.Service
	groupsSvc *groups.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo, nil)

	groupsRepo := groups.NewRepository(db)
	groupsSvc := groups.NewService(groupsRepo, notifSvc, websocket.NewHub())

	return fixture{db: db, notifSvc: notifSvc, groupsSvc: groupsSvc}
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

func TestNotifications_Create_UnreadCountAndMarkAsRead(t *testing.T) {
	f := setup(t)
	receiver := f.newUser(t, "notifreceiver")
	actor := f.newUser(t, "notifactor")

	n, err := f.notifSvc.Create(notifications.CreateNotificationRequest{
		ReceiverID: receiver,
		ActorID:    &actor,
		Type:       notifications.NotificationGroupEvent,
		Message:    "did a thing",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if n.ReceiverID != receiver {
		t.Errorf("ReceiverID = %d, want %d", n.ReceiverID, receiver)
	}

	count, err := f.notifSvc.GetUnreadCount(receiver)
	if err != nil {
		t.Fatalf("GetUnreadCount: %v", err)
	}
	if count != 1 {
		t.Errorf("unread count = %d, want 1", count)
	}

	if err := f.notifSvc.MarkAsRead(n.ID, receiver); err != nil {
		t.Fatalf("MarkAsRead: %v", err)
	}

	count, err = f.notifSvc.GetUnreadCount(receiver)
	if err != nil {
		t.Fatalf("GetUnreadCount after mark-as-read: %v", err)
	}
	if count != 0 {
		t.Errorf("unread count after mark-as-read = %d, want 0", count)
	}
}

func TestNotifications_InvalidType_Rejected(t *testing.T) {
	f := setup(t)
	receiver := f.newUser(t, "notifbadtype")

	_, err := f.notifSvc.Create(notifications.CreateNotificationRequest{
		ReceiverID: receiver,
		Type:       notifications.NotificationType("not_a_real_type"),
		Message:    "should fail",
	})
	if err != notifications.ErrInvalidNotificationType {
		t.Fatalf("expected ErrInvalidNotificationType, got %v", err)
	}
}

func TestNotifications_ScopedToIntendedRecipientOnly(t *testing.T) {
	f := setup(t)
	receiver := f.newUser(t, "notifscopedreceiver")
	otherUser := f.newUser(t, "notifotheruser")
	actor := f.newUser(t, "notifscopedactor")

	if _, err := f.notifSvc.Create(notifications.CreateNotificationRequest{
		ReceiverID: receiver,
		ActorID:    &actor,
		Type:       notifications.NotificationGroupEvent,
		Message:    "for receiver only",
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	receiverNotifs, err := f.notifSvc.GetForUser(receiver, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(receiver): %v", err)
	}
	if len(receiverNotifs) != 1 {
		t.Fatalf("expected 1 notification for the receiver, got %d", len(receiverNotifs))
	}

	otherNotifs, err := f.notifSvc.GetForUser(otherUser, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(otherUser): %v", err)
	}
	if len(otherNotifs) != 0 {
		t.Fatalf("expected the other user to see no notifications, got %d", len(otherNotifs))
	}
}

func TestGroupInvitation_GeneratesNotificationForInvitee(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gninvcreator")
	invitee := f.newUser(t, "gninvinvitee")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Notify Invite Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if err := f.groupsSvc.CreateGroupInvitation(int(groupID), creator, invitee); err != nil {
		t.Fatalf("CreateGroupInvitation: %v", err)
	}

	notifs, err := f.notifSvc.GetForUser(invitee, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(invitee): %v", err)
	}
	if len(notifs) != 1 {
		t.Fatalf("expected 1 notification for the invitee, got %d", len(notifs))
	}
	if notifs[0].Type != notifications.NotificationGroupInvitation {
		t.Errorf("notification type = %q, want %q", notifs[0].Type, notifications.NotificationGroupInvitation)
	}

	// Not visible to anyone else, e.g. the inviter.
	inviterNotifs, err := f.notifSvc.GetForUser(creator, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(creator): %v", err)
	}
	if len(inviterNotifs) != 0 {
		t.Errorf("expected the inviter to receive no notification for their own invite, got %d", len(inviterNotifs))
	}
}

func TestGroupJoinRequest_GeneratesNotificationForCreator(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gnjrcreator")
	requester := f.newUser(t, "gnjrrequester")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Notify Join Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}

	notifs, err := f.notifSvc.GetForUser(creator, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(creator): %v", err)
	}
	if len(notifs) != 1 {
		t.Fatalf("expected 1 notification for the group creator, got %d", len(notifs))
	}
	if notifs[0].Type != notifications.NotificationGroupJoinRequest {
		t.Errorf("notification type = %q, want %q", notifs[0].Type, notifications.NotificationGroupJoinRequest)
	}
}

func TestNewGroupEvent_GeneratesNotificationForMembers(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gnevcreator")
	memberA := f.newUser(t, "gnevmemberA")
	memberB := f.newUser(t, "gnevmemberB")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Notify Event Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), memberA); err != nil {
		t.Fatalf("AddMember A: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), memberB); err != nil {
		t.Fatalf("AddMember B: %v", err)
	}

	future := time.Now().Add(24 * time.Hour)
	if _, err := f.groupsSvc.CreateEvent(int(groupID), creator, "Big Meetup", "Everyone come", future); err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}

	for _, memberID := range []int{memberA, memberB} {
		notifs, err := f.notifSvc.GetForUser(memberID, 10, 0)
		if err != nil {
			t.Fatalf("GetForUser(%d): %v", memberID, err)
		}
		if len(notifs) != 1 {
			t.Fatalf("expected member %d to receive 1 notification, got %d", memberID, len(notifs))
		}
		if notifs[0].Type != notifications.NotificationGroupEvent {
			t.Errorf("notification type = %q, want %q", notifs[0].Type, notifications.NotificationGroupEvent)
		}
	}

	// The creator (the actor) does not notify themselves.
	creatorNotifs, err := f.notifSvc.GetForUser(creator, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(creator): %v", err)
	}
	if len(creatorNotifs) != 0 {
		t.Errorf("expected the event creator to receive no self-notification, got %d", len(creatorNotifs))
	}
}
