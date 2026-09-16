package profile_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"social/internal/requestctx"
	"social/internal/users"
)

func TestUpdateProfileDetails_AuthenticatedUserPersistsChanges(t *testing.T) {
	f := setup(t)
	userID := f.newUser(t, "settingsprofile", false)
	nickname := "Stargazer"
	aboutMe := "Mapping the night sky."
	dateOfBirth := "1994-07-16"
	body, err := json.Marshal(users.UpdateProfileDetailsRequest{
		FirstName:   "Nova",
		LastName:    "Ray",
		Nickname:    &nickname,
		AboutMe:     &aboutMe,
		DateOfBirth: &dateOfBirth,
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/api/users/me/profile", bytes.NewReader(body))
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	rr := httptest.NewRecorder()
	f.usersHandler.UpdateProfileDetailsHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if strings.Contains(strings.ToLower(rr.Body.String()), "password") {
		t.Fatalf("profile update response exposed a password field: %s", rr.Body.String())
	}

	profile, err := f.usersSvc.GetProfileByID(userID)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if profile.FirstName != "Nova" || profile.LastName != "Ray" {
		t.Fatalf("stored name = %q %q, want Nova Ray", profile.FirstName, profile.LastName)
	}
	if !profile.Nickname.Valid || profile.Nickname.String != nickname {
		t.Fatalf("stored nickname = %#v, want %q", profile.Nickname, nickname)
	}
	if !profile.AboutMe.Valid || profile.AboutMe.String != aboutMe {
		t.Fatalf("stored about me = %#v, want %q", profile.AboutMe, aboutMe)
	}
	if !profile.DateOfBirth.Valid || !strings.HasPrefix(profile.DateOfBirth.String, dateOfBirth) {
		t.Fatalf("stored date of birth = %#v, want %q", profile.DateOfBirth, dateOfBirth)
	}
}

func TestUpdateProfileDetails_RequiresAuthenticatedUser(t *testing.T) {
	f := setup(t)
	body := bytes.NewBufferString(`{"first_name":"Nova","last_name":"Ray"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/users/me/profile", body)
	rr := httptest.NewRecorder()

	f.usersHandler.UpdateProfileDetailsHandler(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnauthorized, rr.Body.String())
	}
}

func TestUpdateProfilePrivacy_HandlerPersistsChoice(t *testing.T) {
	f := setup(t)
	userID := f.newUser(t, "settingsprivacy", false)
	req := httptest.NewRequest(
		http.MethodPatch,
		"/api/users/me/privacy",
		bytes.NewBufferString(`{"is_private":true}`),
	)
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	rr := httptest.NewRecorder()

	f.usersHandler.UpdateProfilePrivacyHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	profile, err := f.usersSvc.GetProfileByID(userID)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if !profile.IsPrivate {
		t.Fatal("privacy choice was not persisted")
	}
}
