package followers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"social/internal/followers"
	"social/internal/requestctx"
)

func TestRecommendations_PrioritizesMutualsAndFiltersIneligibleAccounts(t *testing.T) {
	f := setup(t)
	current := f.newUser(t, "currentuser", false)
	mutualOne := f.newUser(t, "mutualone", false)
	mutualTwo := f.newUser(t, "mutualtwo", false)
	mutualCandidate := f.newUser(t, "mutualtarget", false)
	privateCandidate := f.newUser(t, "privatecandidate", true)
	alreadyFollowing := f.newUser(t, "alreadyfollowing", false)
	blockedCandidate := f.newUser(t, "blockedcandidate", false)
	mutedCandidate := f.newUser(t, "mutedcandidate", false)
	mostActive := f.newUser(t, "mostactive", false)
	lessActive := f.newUser(t, "lessactive", false)
	newestFallback := f.newUser(t, "newestfallback", false)

	for _, targetID := range []int{mutualOne, mutualTwo, alreadyFollowing} {
		if err := f.svc.FollowUser(current, targetID); err != nil {
			t.Fatalf("current user follows %d: %v", targetID, err)
		}
	}
	for _, mutualID := range []int{mutualOne, mutualTwo} {
		if err := f.svc.FollowUser(mutualID, mutualCandidate); err != nil {
			t.Fatalf("mutual %d follows candidate: %v", mutualID, err)
		}
	}
	for _, targetID := range []int{privateCandidate, blockedCandidate, mutedCandidate} {
		if err := f.svc.FollowUser(mutualOne, targetID); err != nil {
			t.Fatalf("mutual user follows %d: %v", targetID, err)
		}
	}

	if _, err := f.db.Exec(
		"INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)",
		current,
		blockedCandidate,
	); err != nil {
		t.Fatalf("block recommendation candidate: %v", err)
	}
	if _, err := f.db.Exec(
		"INSERT INTO user_mutes (muter_id, muted_id) VALUES (?, ?)",
		current,
		mutedCandidate,
	); err != nil {
		t.Fatalf("mute recommendation candidate: %v", err)
	}

	createPublicPosts(t, f, mostActive, 3)
	createPublicPosts(t, f, lessActive, 2)
	createPublicPosts(t, f, newestFallback, 1)

	recommendations, err := f.svc.GetRecommendations(current, 4)
	if err != nil {
		t.Fatalf("GetRecommendations: %v", err)
	}
	if len(recommendations) != 4 {
		t.Fatalf("recommendation count = %d, want 4", len(recommendations))
	}

	if recommendations[0].ID != mutualCandidate {
		t.Fatalf("first recommendation ID = %d, want mutual candidate %d", recommendations[0].ID, mutualCandidate)
	}
	if recommendations[0].MutualCount != 2 {
		t.Errorf("mutual count = %d, want 2", recommendations[0].MutualCount)
	}
	if len(recommendations[0].MutualPreview) != 2 {
		t.Errorf("mutual preview = %v, want two handles", recommendations[0].MutualPreview)
	}

	wantIDs := map[int]bool{
		mutualCandidate: true,
		mostActive:      true,
		lessActive:      true,
		newestFallback:  true,
	}
	for _, recommendation := range recommendations {
		if !wantIDs[recommendation.ID] {
			t.Errorf("unexpected recommendation: %#v", recommendation)
		}
		if recommendation.IsFollowing {
			t.Errorf("recommendation %d must not be marked as followed", recommendation.ID)
		}
	}
	for _, excludedID := range []int{
		current,
		alreadyFollowing,
		privateCandidate,
		blockedCandidate,
		mutedCandidate,
	} {
		for _, recommendation := range recommendations {
			if recommendation.ID == excludedID {
				t.Errorf("excluded user %d appeared in recommendations", excludedID)
			}
		}
	}
}

func TestRecommendationsHandler_ReturnsRequestedJSONShape(t *testing.T) {
	f := setup(t)
	current := f.newUser(t, "responsecurrent", false)
	fallback := f.newUser(t, "responsefallback", false)
	createPublicPosts(t, f, fallback, 1)

	handler := followers.NewHandler(f.svc, nil)
	request := httptest.NewRequest(http.MethodGet, "/api/users/recommendations?limit=4", nil)
	request = request.WithContext(requestctx.WithUserID(request.Context(), current))
	recorder := httptest.NewRecorder()

	handler.GetRecommendationsHandler(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response []followers.Recommendation
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode recommendation response: %v", err)
	}
	if len(response) != 1 {
		t.Fatalf("response count = %d, want 1", len(response))
	}
	if response[0].ID != fallback || response[0].Name == "" {
		t.Errorf("response = %#v, want fallback recommendation with a name", response[0])
	}
}

func createPublicPosts(t *testing.T, f fixture, userID, count int) {
	t.Helper()
	for postNumber := 0; postNumber < count; postNumber++ {
		if _, err := f.db.Exec(
			"INSERT INTO posts (user_id, visibility, title, content) VALUES (?, 'public', ?, 'activity')",
			userID,
			"Public activity",
		); err != nil {
			t.Fatalf("create public post: %v", err)
		}
	}
}
