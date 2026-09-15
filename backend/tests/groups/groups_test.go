// Package groups_test covers social/internal/groups: group creation,
// invitations (only the creator may invite, invitee must accept before
// membership, declining doesn't add them), join requests (any non-member
// can request in public groups, only the creator may accept/decline), and that
// creating or viewing group posts/comments requires membership.
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
	groupsHandler    *groups.Handler
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo, nil)

	groupsRepo := groups.NewRepository(db)
	groupsSvc := groups.NewService(groupsRepo, notifSvc, websocket.NewHub())

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo, nil, nil)

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
	commentsSvc := comments.NewService(commentsRepo, postsSvc, nil)

	return fixture{
		db: db, groupsSvc: groupsSvc, notificationsSvc: notifSvc,
		postsSvc: postsSvc, postsHandler: postsHandler, commentsSvc: commentsSvc,
		groupsHandler: groups.NewHandler(groupsSvc, nil),
	}
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

	groupID, err := f.groupsSvc.CreateGroup(creator, "Book Club", "We read books", "", groups.GroupPrivacyPrivate)
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
	if g.Privacy != groups.GroupPrivacyPrivate {
		t.Errorf("Privacy = %q, want %q", g.Privacy, groups.GroupPrivacyPrivate)
	}

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), creator)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if !isMember {
		t.Errorf("expected creator to automatically be a member of the group they created")
	}
}

func TestCreateGroup_PrivacyValidationAndDefault(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "privacycreator")

	publicID, err := f.groupsSvc.CreateGroup(
		creator,
		"Public Group",
		"Open membership",
		"",
		groups.GroupPrivacyPublic,
	)
	if err != nil {
		t.Fatalf("create public group: %v", err)
	}
	publicGroup, err := f.groupsSvc.GetGroupByID(int(publicID))
	if err != nil {
		t.Fatalf("get public group: %v", err)
	}
	if publicGroup.Privacy != groups.GroupPrivacyPublic {
		t.Fatalf("Privacy = %q, want public", publicGroup.Privacy)
	}

	defaultID, err := f.groupsSvc.CreateGroup(
		creator,
		"Legacy Client Group",
		"",
		"",
		groups.GroupPrivacy(""),
	)
	if err != nil {
		t.Fatalf("create group with omitted privacy: %v", err)
	}
	defaultGroup, err := f.groupsSvc.GetGroupByID(int(defaultID))
	if err != nil {
		t.Fatalf("get default-public group: %v", err)
	}
	if defaultGroup.Privacy != groups.GroupPrivacyPublic {
		t.Fatalf("default Privacy = %q, want public", defaultGroup.Privacy)
	}

	if _, err := f.groupsSvc.CreateGroup(
		creator,
		"Invalid Privacy Group",
		"",
		"",
		groups.GroupPrivacy("hidden"),
	); err == nil {
		t.Fatal("expected hidden privacy to be rejected")
	}
}

func TestGroupDiscovery_ReturnsOnlyPublicGroups(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "discoverycreator")
	viewer := f.newUser(t, "discoveryviewer")

	publicID, err := f.groupsSvc.CreateGroup(creator, "Visible Astronomy", "public search marker", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create public group: %v", err)
	}
	privateID, err := f.groupsSvc.CreateGroup(creator, "Hidden Astronomy", "private search marker", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("create private group: %v", err)
	}

	discovered, err := f.groupsSvc.GetAllGroups(20, 0, viewer, "")
	if err != nil {
		t.Fatalf("GetAllGroups: %v", err)
	}
	if len(discovered) != 1 || discovered[0].ID != int(publicID) {
		t.Fatalf("discovered groups = %#v, want only public group %d", discovered, publicID)
	}

	privateSearch, err := f.groupsSvc.GetAllGroups(20, 0, viewer, "private search marker")
	if err != nil {
		t.Fatalf("search groups: %v", err)
	}
	if len(privateSearch) != 0 {
		t.Fatalf("private search returned %d groups, want 0", len(privateSearch))
	}

	mine, err := f.groupsSvc.GetUserGroups(creator, 20, 0, "")
	if err != nil {
		t.Fatalf("GetUserGroups: %v", err)
	}
	if len(mine) != 2 {
		t.Fatalf("creator's groups = %d, want public and private", len(mine))
	}
	seenPrivate := false
	for _, group := range mine {
		seenPrivate = seenPrivate || group.ID == int(privateID)
	}
	if !seenPrivate {
		t.Fatal("My Groups must retain private groups for their members")
	}
}

func TestGroupRecommendations_FilterAndRankEligiblePublicGroups(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "recommendviewer")
	friend := f.newUser(t, "orbitfriend")
	creator := f.newUser(t, "recommendcreator")

	mutualID, err := f.groupsSvc.CreateGroup(creator, "Orbital Dynamics", "", "groups/orbit.png", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create mutual group: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(mutualID), friend); err != nil {
		t.Fatalf("add mutual member: %v", err)
	}
	if _, err := followers.NewRepository(f.db).FollowUser(viewer, friend); err != nil {
		t.Fatalf("follow friend: %v", err)
	}

	activeID, err := f.groupsSvc.CreateGroup(creator, "Active Explorers", "", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create active group: %v", err)
	}
	if _, err := f.db.Exec(`INSERT INTO posts (user_id, title, content, group_id) VALUES (?, 'Recent', 'Activity', ?)`, creator, activeID); err != nil {
		t.Fatalf("create recent group post: %v", err)
	}
	inactiveID, err := f.groupsSvc.CreateGroup(creator, "Quiet Explorers", "", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create inactive group: %v", err)
	}

	joinedID, _ := f.groupsSvc.CreateGroup(creator, "Already Joined", "", "", groups.GroupPrivacyPublic)
	if err := f.groupsSvc.AddMember(int(joinedID), viewer); err != nil {
		t.Fatalf("join excluded group: %v", err)
	}
	pendingID, _ := f.groupsSvc.CreateGroup(creator, "Already Requested", "", "", groups.GroupPrivacyPublic)
	if err := f.groupsSvc.RequestToJoin(int(pendingID), viewer); err != nil {
		t.Fatalf("request excluded group: %v", err)
	}
	privateID, _ := f.groupsSvc.CreateGroup(creator, "Secret Orbit", "", "", groups.GroupPrivacyPrivate)

	recommendations, err := f.groupsSvc.GetRecommendations(viewer, 99)
	if err != nil {
		t.Fatalf("GetRecommendations: %v", err)
	}
	if len(recommendations) != 3 {
		t.Fatalf("recommendation count = %d, want 3", len(recommendations))
	}
	if recommendations[0].ID != int(mutualID) {
		t.Fatalf("first recommendation = %d, want mutual group %d", recommendations[0].ID, mutualID)
	}
	if recommendations[1].ID != int(activeID) || recommendations[2].ID != int(inactiveID) {
		t.Fatalf("fallback order = [%d, %d], want active then inactive [%d, %d]", recommendations[1].ID, recommendations[2].ID, activeID, inactiveID)
	}
	first := recommendations[0]
	if first.MutualMemberCount != 1 || len(first.MutualMemberPreview) != 1 || first.MutualMemberPreview[0] != "orbitfriend" {
		t.Fatalf("mutual context = count %d preview %#v", first.MutualMemberCount, first.MutualMemberPreview)
	}
	if first.Slug != "orbital-dynamics" || first.AvatarURL != "/uploads/groups/orbit.png" || !first.RequiresApproval {
		t.Fatalf("recommendation contract = %#v", first)
	}
	for _, recommendation := range recommendations {
		if recommendation.ID == int(joinedID) || recommendation.ID == int(pendingID) || recommendation.ID == int(privateID) {
			t.Fatalf("ineligible group %d appeared in recommendations", recommendation.ID)
		}
	}
}

func TestPrivateGroup_IsHiddenAndRejectsJoinRequests(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "privatecreator")
	member := f.newUser(t, "privatemember")
	outsider := f.newUser(t, "privateoutsider")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Invite Only", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	if _, err := f.groupsSvc.GetGroupForUser(int(groupID), outsider); err != groups.ErrGroupNotFound {
		t.Fatalf("private detail error = %v, want ErrGroupNotFound", err)
	}
	if _, err := f.groupsSvc.GetVisibleGroupMembers(int(groupID), outsider); err != groups.ErrGroupNotFound {
		t.Fatalf("private members error = %v, want ErrGroupNotFound", err)
	}
	if _, err := f.groupsSvc.GetMembership(int(groupID), outsider); err != groups.ErrGroupNotFound {
		t.Fatalf("private membership error = %v, want ErrGroupNotFound", err)
	}
	if _, err := f.groupsSvc.GetGroupForUser(int(groupID), member); err != nil {
		t.Fatalf("member should see private group: %v", err)
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), outsider); err != groups.ErrJoinRequestNotAllowed {
		t.Fatalf("private join request error = %v, want ErrJoinRequestNotAllowed", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/groups/join-requests", nil)
	req.SetPathValue("id", strconv.FormatInt(groupID, 10))
	req = req.WithContext(requestctx.WithUserID(req.Context(), outsider))
	rr := httptest.NewRecorder()
	f.groupsHandler.CreateJoinRequestHandler(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("private join request status = %d, want %d", rr.Code, http.StatusForbidden)
	}
}

func TestJoinRequest_PublicRemainsPendingUntilCreatorApproval(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "publiccreator")
	requester := f.newUser(t, "publicrequester")

	groupID, err := f.groupsSvc.CreateGroup(
		creator,
		"Open Community",
		"",
		"",
		groups.GroupPrivacyPublic,
	)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != nil {
		t.Fatalf("RequestToJoin: %v", err)
	}
	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), requester)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if isMember {
		t.Fatal("public join request must not create membership before approval")
	}
	requests, err := f.groupsSvc.GetPendingJoinRequests(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetPendingJoinRequests: %v", err)
	}
	if len(requests) != 1 {
		t.Fatalf("public join created %d pending requests, want 1", len(requests))
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != groups.ErrJoinRequestAlreadyPending {
		t.Fatalf("duplicate public request error = %v, want ErrJoinRequestAlreadyPending", err)
	}
	if err := f.groupsSvc.AcceptJoinRequest(int(groupID), requests[0].ID, creator); err != nil {
		t.Fatalf("AcceptJoinRequest: %v", err)
	}
	isMember, err = f.groupsSvc.IsGroupMember(int(groupID), requester)
	if err != nil {
		t.Fatalf("IsGroupMember after approval: %v", err)
	}
	if !isMember {
		t.Fatal("approved public join request must create membership")
	}
}

func TestGroupInvitation_OnlyCreatorCanInvite(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "invcreator")
	member := f.newUser(t, "invmember")
	outsider := f.newUser(t, "invoutsider")
	invitee := f.newUser(t, "invitee1")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Private Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	// Neither a regular member nor an unrelated user has invitation authority.
	err = f.groupsSvc.CreateGroupInvitation(int(groupID), member, invitee)
	if err != groups.ErrNotGroupCreator {
		t.Fatalf("member invite error = %v, want ErrNotGroupCreator", err)
	}
	err = f.groupsSvc.CreateGroupInvitation(int(groupID), outsider, invitee)
	if err != groups.ErrNotGroupCreator {
		t.Fatalf("outsider invite error = %v, want ErrNotGroupCreator", err)
	}
	if _, err := f.groupsSvc.SearchInviteCandidates(int(groupID), member, "invite", 10); err != groups.ErrNotGroupCreator {
		t.Fatalf("member candidate search error = %v, want ErrNotGroupCreator", err)
	}

	// The creator is the group's sole admin and can invite.
	if _, err := f.groupsSvc.SearchInviteCandidates(int(groupID), creator, "invite", 10); err != nil {
		t.Fatalf("creator candidate search: %v", err)
	}
	if err := f.groupsSvc.CreateGroupInvitation(int(groupID), creator, invitee); err != nil {
		t.Fatalf("expected creator to be able to invite, got %v", err)
	}
}

func TestGroupInvitation_MustBeAcceptedBeforeMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "acceptcreator")
	invitee := f.newUser(t, "acceptinvitee")
	otherUser := f.newUser(t, "acceptother")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Accept Group", "", "", groups.GroupPrivacyPrivate)
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
	if err := f.groupsSvc.AcceptGroupInvitation(pending[0].ID, otherUser); err != groups.ErrInvitationNotFound {
		t.Fatalf("accepting another user's invitation error = %v, want ErrInvitationNotFound", err)
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
	if err := f.groupsSvc.AcceptGroupInvitation(pending[0].ID, invitee); err != groups.ErrInvitationNotPending {
		t.Fatalf("accepting invitation twice error = %v, want ErrInvitationNotPending", err)
	}
}

func TestGroupInvitation_Declining_DoesNotAddMember(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "declinecreator")
	invitee := f.newUser(t, "declineinvitee")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Decline Group", "", "", groups.GroupPrivacyPrivate)
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

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group", "", "", groups.GroupPrivacyPublic)
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

	isMember, err := f.groupsSvc.IsGroupMember(int(groupID), requester)
	if err != nil {
		t.Fatalf("IsGroupMember: %v", err)
	}
	if isMember {
		t.Fatal("public join request must not create membership before approval")
	}
	if err := f.groupsSvc.RequestToJoin(int(groupID), requester); err != groups.ErrJoinRequestAlreadyPending {
		t.Fatalf("duplicate public request error = %v, want ErrJoinRequestAlreadyPending", err)
	}
}

func TestJoinRequest_OnlyCreatorCanAcceptOrDecline(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "joincreator2")
	requester := f.newUser(t, "joinrequester2")
	otherMember := f.newUser(t, "joinother2")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 2", "", "", groups.GroupPrivacyPublic)
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

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 3", "", "", groups.GroupPrivacyPublic)
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

	groupID, err := f.groupsSvc.CreateGroup(creator, "Join Group 4", "", "", groups.GroupPrivacyPublic)
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

	groupID, err := f.groupsSvc.CreateGroup(creator, "GP Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	postID, status := f.newGroupPost(t, member, int(groupID))
	if status != http.StatusCreated {
		t.Fatalf("expected a member to be able to post to the group, got status %d", status)
	}

	if _, status := f.newGroupPost(t, nonMember, int(groupID)); status != http.StatusForbidden {
		t.Fatalf("expected a non-member's group post to be rejected, got status %d", status)
	}

	if _, err := f.postsSvc.ListGroupPosts(int(groupID), member, 50); err != nil {
		t.Fatalf("member should be able to list group posts: %v", err)
	}
	if _, err := f.postsSvc.ListGroupPosts(int(groupID), nonMember, 50); err != groups.ErrNotGroupMember {
		t.Fatalf("non-member list error = %v, want ErrNotGroupMember", err)
	}
	canAccess, err := f.postsSvc.CanAccess(nonMember, postID)
	if err != nil {
		t.Fatalf("CanAccess group post: %v", err)
	}
	if canAccess {
		t.Fatal("non-member must not be able to read a group post or its comments")
	}
}

func TestGroupComment_RequiresMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "gccreator")
	member := f.newUser(t, "gcmember")
	nonMember := f.newUser(t, "gcnonmember")

	groupID, err := f.groupsSvc.CreateGroup(creator, "GC Group", "", "", groups.GroupPrivacyPrivate)
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

func TestPublicGroupContent_StillRequiresMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "publiccontentcreator")
	outsider := f.newUser(t, "publiccontentoutsider")

	groupID, err := f.groupsSvc.CreateGroup(creator, "Public Metadata Only", "", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	postID, status := f.newGroupPost(t, creator, int(groupID))
	if status != http.StatusCreated {
		t.Fatalf("failed to seed public-group post, status %d", status)
	}

	if _, err := f.postsSvc.ListGroupPosts(int(groupID), outsider, 50); err != groups.ErrNotGroupMember {
		t.Fatalf("public-group post list error = %v, want ErrNotGroupMember", err)
	}
	canAccess, err := f.postsSvc.CanAccess(outsider, postID)
	if err != nil {
		t.Fatalf("CanAccess public-group post: %v", err)
	}
	if canAccess {
		t.Fatal("public privacy must not expose group post or comment content")
	}
	if err := f.postsSvc.CanCreateComment(outsider, postID); err != groups.ErrNotGroupMember {
		t.Fatalf("public-group comment error = %v, want ErrNotGroupMember", err)
	}
}
