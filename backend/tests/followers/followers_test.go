// Package followers_test covers social/internal/followers: sending follow
// requests to private profiles, auto-following public profiles,
// accepting/declining requests, unfollowing, and duplicate-request
// prevention.
package followers_test

import (
	"database/sql"
	"testing"

	"social/internal/followers"
	"social/internal/users"
	"social/tests/testutil"
)

type fixture struct {
	db    *sql.DB
	svc   *followers.Service
	users *users.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)
	repo := followers.NewRepository(db)
	svc := followers.NewService(repo, nil)

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, svc)

	return fixture{db: db, svc: svc, users: usersSvc}
}

func (f fixture) newUser(t *testing.T, username string, isPrivate bool) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{
		Username:  username,
		Email:     username + "@example.com",
		IsPrivate: isPrivate,
	})
}

func TestFollow_PrivateProfile_CreatesPendingRequest_NotActiveFollow(t *testing.T) {
	f := setup(t)
	requester := f.newUser(t, "requester", false)
	target := f.newUser(t, "privatetarget", true)

	if err := f.svc.CreateFollowRequest(requester, target); err != nil {
		t.Fatalf("CreateFollowRequest: %v", err)
	}

	pending, err := f.svc.HasPendingFollowRequest(requester, target)
	if err != nil {
		t.Fatalf("HasPendingFollowRequest: %v", err)
	}
	if !pending {
		t.Errorf("expected a pending follow request")
	}

	isFollowing, err := f.svc.IsFollowing(requester, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if isFollowing {
		t.Errorf("expected no active follow before the request is accepted")
	}
}

func TestFollow_PublicProfile_ActiveFollowImmediately_NoPendingRequest(t *testing.T) {
	f := setup(t)
	follower := f.newUser(t, "follower1", false)
	target := f.newUser(t, "publictarget", false)

	if err := f.svc.FollowUser(follower, target); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	isFollowing, err := f.svc.IsFollowing(follower, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if !isFollowing {
		t.Fatalf("expected an active follow immediately for a public profile")
	}

	pending, err := f.svc.HasPendingFollowRequest(follower, target)
	if err != nil {
		t.Fatalf("HasPendingFollowRequest: %v", err)
	}
	if pending {
		t.Errorf("expected no pending follow request when following a public profile directly")
	}
}

func TestAcceptFollowRequest_ActivatesFollow(t *testing.T) {
	f := setup(t)
	requester := f.newUser(t, "acceptreq", false)
	target := f.newUser(t, "acceptTarget", true)

	if err := f.svc.CreateFollowRequest(requester, target); err != nil {
		t.Fatalf("CreateFollowRequest: %v", err)
	}

	pendingList, err := f.svc.GetPendingFollowRequests(target)
	if err != nil {
		t.Fatalf("GetPendingFollowRequests: %v", err)
	}
	if len(pendingList) != 1 {
		t.Fatalf("expected 1 pending request, got %d", len(pendingList))
	}

	if err := f.svc.AcceptFollowRequest(pendingList[0].ID, target); err != nil {
		t.Fatalf("AcceptFollowRequest: %v", err)
	}

	isFollowing, err := f.svc.IsFollowing(requester, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if !isFollowing {
		t.Fatalf("expected an active follow after accepting the request")
	}
}

func TestDeclineFollowRequest_RemovesRequest_NoFollowCreated(t *testing.T) {
	f := setup(t)
	requester := f.newUser(t, "declinereq", false)
	target := f.newUser(t, "declineTarget", true)

	if err := f.svc.CreateFollowRequest(requester, target); err != nil {
		t.Fatalf("CreateFollowRequest: %v", err)
	}

	pendingList, err := f.svc.GetPendingFollowRequests(target)
	if err != nil {
		t.Fatalf("GetPendingFollowRequests: %v", err)
	}
	if len(pendingList) != 1 {
		t.Fatalf("expected 1 pending request, got %d", len(pendingList))
	}

	if err := f.svc.DeclineFollowRequest(pendingList[0].ID, target); err != nil {
		t.Fatalf("DeclineFollowRequest: %v", err)
	}

	isFollowing, err := f.svc.IsFollowing(requester, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if isFollowing {
		t.Errorf("declining a follow request must not create a follow")
	}

	stillPending, err := f.svc.HasPendingFollowRequest(requester, target)
	if err != nil {
		t.Fatalf("HasPendingFollowRequest: %v", err)
	}
	if stillPending {
		t.Errorf("declined request must no longer be pending")
	}

	remaining, err := f.svc.GetPendingFollowRequests(target)
	if err != nil {
		t.Fatalf("GetPendingFollowRequests: %v", err)
	}
	if len(remaining) != 0 {
		t.Errorf("expected no remaining pending requests, got %d", len(remaining))
	}
}

func TestUnfollow_RequiresExistingFollow(t *testing.T) {
	f := setup(t)
	follower := f.newUser(t, "unfollower", false)
	target := f.newUser(t, "unfollowTarget", false)

	if err := f.svc.FollowUser(follower, target); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	if err := f.svc.UnfollowUser(follower, target); err != nil {
		t.Fatalf("UnfollowUser: %v", err)
	}

	isFollowing, err := f.svc.IsFollowing(follower, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if isFollowing {
		t.Fatalf("expected follow to be removed after unfollow")
	}
}

func TestUnfollow_NonFollowedUser_NoOp(t *testing.T) {
	f := setup(t)
	follower := f.newUser(t, "neverfollowed", false)
	target := f.newUser(t, "untouchedTarget", false)

	// Unfollowing someone you were never following is a no-op deletion (0
	// rows affected), not an error - it should not panic or fail.
	if err := f.svc.UnfollowUser(follower, target); err != nil {
		t.Fatalf("expected unfollowing a non-followed user to succeed as a no-op, got %v", err)
	}

	isFollowing, err := f.svc.IsFollowing(follower, target)
	if err != nil {
		t.Fatalf("IsFollowing: %v", err)
	}
	if isFollowing {
		t.Errorf("expected no follow relationship to exist")
	}
}

func TestFollow_DuplicateRequest_Prevented(t *testing.T) {
	f := setup(t)
	requester := f.newUser(t, "dupreq", false)
	target := f.newUser(t, "dupTarget", true)

	if err := f.svc.CreateFollowRequest(requester, target); err != nil {
		t.Fatalf("first CreateFollowRequest: %v", err)
	}

	err := f.svc.CreateFollowRequest(requester, target)
	if err != followers.ErrFollowRequestAlreadyPending {
		t.Fatalf("expected ErrFollowRequestAlreadyPending on duplicate request, got %v", err)
	}
}

func TestFollow_CannotFollowSelf(t *testing.T) {
	f := setup(t)
	user := f.newUser(t, "selffollower", false)

	if err := f.svc.FollowUser(user, user); err != followers.ErrCannotFollowSelf {
		t.Fatalf("expected ErrCannotFollowSelf, got %v", err)
	}
}
