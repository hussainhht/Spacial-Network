// Package profile_test covers social/internal/users profile visibility
// rules and the HTTP handler's response shaping: public profiles are
// readable by anyone, private profiles only by the owner and accepted
// followers, the JSON response never carries a password field, and the
// privacy toggle persists.
package profile_test

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"social/internal/followers"
	"social/internal/requestctx"
	"social/internal/users"
	"social/tests/testutil"
)

type fixture struct {
	db          *sql.DB
	usersSvc    *users.Service
	usersHandler *users.Handler
	followersSvc *followers.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo)

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, followersSvc)

	return fixture{
		db:           db,
		usersSvc:     usersSvc,
		usersHandler: users.NewHandler(usersSvc),
		followersSvc: followersSvc,
	}
}

func (f fixture) newUser(t *testing.T, username string, isPrivate bool) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{
		Username:  username,
		Email:     username + "@example.com",
		IsPrivate: isPrivate,
	})
}

func getProfile(t *testing.T, h *users.Handler, viewerID int, username string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/users/"+username, nil)
	req.SetPathValue("username", username)
	req = req.WithContext(requestctx.WithUserID(req.Context(), viewerID))
	rr := httptest.NewRecorder()
	h.GetProfileHandler(rr, req)
	return rr
}

func TestPublicProfile_RetrievableByAnyUser(t *testing.T) {
	f := setup(t)
	f.newUser(t, "publicowner", false)
	viewer := f.newUser(t, "randomviewer", false)

	rr := getProfile(t, f.usersHandler, viewer, "publicowner")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	var resp users.GetProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !resp.Profile.CanViewFullProfile {
		t.Errorf("expected CanViewFullProfile=true for a public profile")
	}
}

func TestPrivateProfile_OnlyOwnerAndAcceptedFollowers(t *testing.T) {
	f := setup(t)
	owner := f.newUser(t, "privateowner", true)
	stranger := f.newUser(t, "stranger", false)
	acceptedFollower := f.newUser(t, "acceptedfollower", false)

	// Owner viewing their own profile.
	rr := getProfile(t, f.usersHandler, owner, "privateowner")
	var ownerResp users.GetProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &ownerResp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !ownerResp.Profile.CanViewFullProfile {
		t.Errorf("owner must always be able to view their own full profile")
	}

	// A stranger with no follow relationship.
	rr = getProfile(t, f.usersHandler, stranger, "privateowner")
	var strangerResp users.GetProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &strangerResp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if strangerResp.Profile.CanViewFullProfile {
		t.Errorf("a stranger must not be able to view a private profile's full data")
	}

	// An accepted follower.
	if err := f.followersSvc.CreateFollowRequest(acceptedFollower, owner); err != nil {
		t.Fatalf("CreateFollowRequest: %v", err)
	}
	pending, err := f.followersSvc.GetPendingFollowRequests(owner)
	if err != nil {
		t.Fatalf("GetPendingFollowRequests: %v", err)
	}
	if err := f.followersSvc.AcceptFollowRequest(pending[0].ID, owner); err != nil {
		t.Fatalf("AcceptFollowRequest: %v", err)
	}

	rr = getProfile(t, f.usersHandler, acceptedFollower, "privateowner")
	var followerResp users.GetProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &followerResp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !followerResp.Profile.CanViewFullProfile {
		t.Errorf("an accepted follower must be able to view a private profile's full data")
	}
}

func TestProfileResponse_NeverIncludesPassword(t *testing.T) {
	f := setup(t)
	f.newUser(t, "profilecheck", false)
	viewer := f.newUser(t, "viewer2", false)

	rr := getProfile(t, f.usersHandler, viewer, "profilecheck")
	body := rr.Body.String()

	if strings.Contains(strings.ToLower(body), "password") {
		t.Fatalf("profile response must never mention a password field; got body: %s", body)
	}
}

func TestUpdateProfilePrivacy_PersistsVisibilityFlag(t *testing.T) {
	f := setup(t)
	userID := f.newUser(t, "toggleuser", false)

	if err := f.usersSvc.UpdateProfilePrivacy(userID, true); err != nil {
		t.Fatalf("UpdateProfilePrivacy(true): %v", err)
	}
	profile, err := f.usersSvc.GetProfileByID(userID)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if !profile.IsPrivate {
		t.Errorf("expected IsPrivate=true after toggling to private")
	}

	if err := f.usersSvc.UpdateProfilePrivacy(userID, false); err != nil {
		t.Fatalf("UpdateProfilePrivacy(false): %v", err)
	}
	profile, err = f.usersSvc.GetProfileByID(userID)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if profile.IsPrivate {
		t.Errorf("expected IsPrivate=false after toggling back to public")
	}
}

func TestProfile_AggregatesFollowersAndFollowing(t *testing.T) {
	f := setup(t)
	center := f.newUser(t, "centeruser", false)
	followerA := f.newUser(t, "followerA", false)
	followerB := f.newUser(t, "followerB", false)
	followedC := f.newUser(t, "followedC", false)

	if err := f.followersSvc.FollowUser(followerA, center); err != nil {
		t.Fatalf("FollowUser A->center: %v", err)
	}
	if err := f.followersSvc.FollowUser(followerB, center); err != nil {
		t.Fatalf("FollowUser B->center: %v", err)
	}
	if err := f.followersSvc.FollowUser(center, followedC); err != nil {
		t.Fatalf("FollowUser center->C: %v", err)
	}

	followersList, err := f.followersSvc.GetFollowers(center)
	if err != nil {
		t.Fatalf("GetFollowers: %v", err)
	}
	if len(followersList) != 2 {
		t.Errorf("followers count = %d, want 2", len(followersList))
	}

	followingList, err := f.followersSvc.GetFollowing(center)
	if err != nil {
		t.Fatalf("GetFollowing: %v", err)
	}
	if len(followingList) != 1 {
		t.Errorf("following count = %d, want 1", len(followingList))
	}
	if len(followingList) == 1 && followingList[0].Username != "followedC" {
		t.Errorf("following[0].Username = %q, want %q", followingList[0].Username, "followedC")
	}
}
