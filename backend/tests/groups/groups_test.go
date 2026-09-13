// Package groups_test covers social/internal/groups: group creation,
// invitations (only members/creator may invite, invitee must accept before
// membership, declining doesn't add them), join requests (any non-member
// can request, only the creator may accept/decline), and that creating
// group posts/comments requires membership.
package groups_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"social/internal/comments"
	"social/internal/followers"
	"social/internal/groups"
	"social/internal/notifications"
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db               *sql.DB
	groupsSvc        *groups.Service
	notificationsSvc *notifications.Service
	postsSvc         *posts.Service
	postsHandler     *posts.Handler
	commentsSvc      *comments.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo, nil)

	groupsRepo := groups.NewRepository(db)
	groupsSvc := groups.NewService(groupsRepo, notifSvc, websocket.NewHub())

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo)

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, followersSvc)

	postsRepo := posts.NewRepository(db)
	postsSvc := posts.NewService(postsRepo, followersSvc, groupsSvc)

	mediaStorage, err := upload.NewMediaStorage(t.TempDir(), upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage: %v", err)
	}
	postsHandler := posts.NewHandler(postsSvc, usersSvc, groupsSvc, mediaStorage, "session_token", false, 0)

	commentsRepo := comments.NewRepository(db)
	commentsSvc := comments.NewService(commentsRepo, postsSvc)

	return fixture{db: db, groupsSvc: groupsSvc, notificationsSvc: notifSvc, postsSvc: postsSvc, postsHandler: postsHandler, commentsSvc: commentsSvc}
}

// newGroupPost creates a post inside groupID on behalf of authorID via the
// HTTP handler (posts.post is unexported, so this is the only way to reach
// CreateGroupPost from outside the posts package) and returns the new
// post's ID.
func (f fixture) newGroupPost(t *testing.T, authorID, groupID int) (postID int, status int) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("title", "Group post")
	w.WriteField("content", "Group post content")
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/groups/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.SetPathValue("id", strconv.Itoa(groupID))
	req = req.WithContext(requestctx.WithUserID(req.Context(), authorID))

	rr := httptest.NewRecorder()
	f.postsHandler.NewGroupPostHandler(rr, req)

	if rr.Code != http.StatusCreated {
		return 0, rr.Code
	}
	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal group post response: %v", err)
	}
	return resp.ID, rr.Code
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

func TestCreateGroup_StoresTitleDescriptionAndCreator(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "groupcreator")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Book Club", "We read books", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	g, err := f.groupsSvc.GetGroupByID(int(groupID))
	if err != nil {
		t.Fatalf("GetGroupByID: %v", err)
	}
	if g.Title != "Book Club" {
		t.Errorf("Title = %q, want %q", g.Title, "Book Club")
	}
	if g.Description != "We read books" {
		t.Errorf("Description = %q, want %q", g.Description, "We read books")
	}
	if g.CreatorID != creator {
		t.Errorf("CreatorID = %d, want %d", g.CreatorID, creator)
	}

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), creator)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if !isMember {
		t.Errorf("expected creator to automatically be a member of the group they created")
	}
}

func TestGroupInvitation_OnlyMembersCanInvite(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "invcreator")
	outsider := f.newUser(t, "invoutsider")
	invitee := f.newUser(t, "invitee1")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Private Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	// A non-member trying to invite someone must be rejected.
	err = f.groupsSvc.CreateGroupInvitation(int(groupID), outsider, invitee)
	if err != groups.ErrNotGroupMember {
		t.Fatalf("expected ErrNotGroupMember for a non-member inviter, got %v", err)
	}

	// The creator (a member) can invite.
	if err := f.groupsSvc.CreateGroupInvitation(int(groupID), creator, invitee); err != nil {
		t.Fatalf("expected creator to be able to invite, got %v", err)
	}
}

func TestGroupInvitation_MustBeAcceptedBeforeMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "acceptcreator")
	invitee := f.newUser(t, "acceptinvitee")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Accept Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.CreateGroupInvitation(int(groupID), creator, invitee); err != nil {
		t.Fatalf("CreateGroupInvitation: %v", err)
	}

	// Not a member yet, until they accept.
	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), invitee)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if isMember {
		t.Fatalf("invitee must not be a member before accepting the invitation")
	}

	pending, err := f.groupsSvc.GetPendingInvitations(invitee)
	if err != nil {
		t.Fatalf("GetPendingInvitations: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("expected 1 pending invitation, got %d", len(pending))
	}

	if err := f.groupsSvc.AcceptGroupInvitation(pending[0].ID, invitee); err != nil {
		t.Fatalf("AcceptGroupInvitation: %v", err)
	}

	isMember, err = f.groupsSvc.IsGroupMember(int(groupID), invitee)
	if err != nil {
		t.Fatalf("IsGroupMember after accept: %v", err)
	}
	if !isMember {
		t.Fatalf("expected invitee to be a member after accepting")
	}
}

func TestGroupInvitation_Declining_DoesNotAddMember(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "declinecreator")
	invitee := f.newUser(t, "declineinvitee")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Decline Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.CreateGroupInvitation(int(groupID), creator, invitee); err != nil {
		t.Fatalf("CreateGroupInvitation: %v", err)
	}

	pending, err := f.groupsSvc.GetPendingInvitations(invitee)
	if err != nil {
		t.Fatalf("GetPendingInvitations: %v", err)
	}

	if err := f.groupsSvc.DeclineGroupInvitation(pending[0].ID, invitee); err != nil {
		t.Fatalf("DeclineGroupInvitation: %v", err)
	}

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), invitee)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if isMember {
		t.Fatalf("declining an invitation must not add the user as a member")
	}
}

func TestJoinRequest_NonMemberCanRequest(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "joincreator")
	requester := f.newUser(t, "joinrequester")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}

	pending, err := f.groupsSvc.GetPendingJoinRequests(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetPendingJoinRequests: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("expected 1 pending join request, got %d", len(pending))
	}
}

func TestJoinRequest_OnlyCreatorCanAcceptOrDecline(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "joincreator2")
	requester := f.newUser(t, "joinrequester2")
	otherMember := f.newUser(t, "joinother2")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 2", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), otherMember); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}

	pending, err := f.groupsSvc.GetPendingJoinRequests(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetPendingJoinRequests: %v", err)
	}

	// A regular member (not the creator) may not decide on the request.
	err = f.groupsSvc.AcceptJoinRequest(int(groupID), pending[0].ID, otherMember)
	if err != groups.ErrNotGroupCreator {
		t.Fatalf("expected ErrNotGroupCreator when a non-creator member tries to accept, got %v", err)
	}
}

func TestJoinRequest_Accepting_AddsMember(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "joincreator3")
	requester := f.newUser(t, "joinrequester3")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 3", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}
	pending, err := f.groupsSvc.GetPendingJoinRequests(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetPendingJoinRequests: %v", err)
	}

	if err := f.groupsSvc.AcceptJoinRequest(int(groupID), pending[0].ID, creator); err != nil {
		t.Fatalf("AcceptJoinRequest: %v", err)
	}

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), requester)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if !isMember {
		t.Fatalf("expected requester to become a member after acceptance")
	}
}

func TestJoinRequest_Declining_DoesNotAddMember(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "joincreator4")
	requester := f.newUser(t, "joinrequester4")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 4", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}
	pending, err := f.groupsSvc.GetPendingJoinRequests(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetPendingJoinRequests: %v", err)
	}

	if err := f.groupsSvc.RejectJoinRequest(int(groupID), pending[0].ID, creator); err != nil {
		t.Fatalf("RejectJoinRequest: %v", err)
	}

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), requester)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if isMember {
		t.Fatalf("declining a join request must not add the requester as a member")
	}
}

func TestGroupPost_RequiresMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gpcreator")
	member := f.newUser(t, "gpmember")
	nonMember := f.newUser(t, "gpnonmember")

	groupID, err := f.groupsSvc.CreateGroup(creator, "GP Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	if _, status := f.newGroupPost(t, member, int(groupID)); status != http.StatusCreated {
		t.Fatalf("expected a member to be able to post to the group, got status %d", status)
	}

	if _, status := f.newGroupPost(t, nonMember, int(groupID)); status != http.StatusForbidden {
		t.Fatalf("expected a non-member's group post to be rejected, got status %d", status)
	}
}

func TestGroupComment_RequiresMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gccreator")
	member := f.newUser(t, "gcmember")
	nonMember := f.newUser(t, "gcnonmember")

	groupID, err := f.groupsSvc.CreateGroup(creator, "GC Group", "", "")
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	postID, status := f.newGroupPost(t, creator, int(groupID))
	if status != http.StatusCreated {
		t.Fatalf("failed to seed group post, status %d", status)
	}

	if err := f.postsSvc.CanCreateComment(member, postID); err != nil {
		t.Errorf("expected a group member to be able to comment, got %v", err)
	}

	if err := f.postsSvc.CanCreateComment(nonMember, postID); err != groups.ErrNotGroupMember {
		t.Errorf("expected ErrNotGroupMember for a non-member commenter, got %v", err)
	}
}
