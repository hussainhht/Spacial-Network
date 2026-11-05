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

func patchDetails(t *testing.T, f fixture, userID int, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPatch, "/api/users/me/profile", bytes.NewBufferString(body))
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	rr := httptest.NewRecorder()
	f.usersHandler.UpdateProfileDetailsHandler(rr, req)
	return rr
}

func profileJSON(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out struct {
		Profile map[string]any `json:"profile"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v; body=%s", err, rr.Body.String())
	}
	return out.Profile
}

func TestBirthdayVisibility_DefaultsToPrivateAndHiddenFromOthers(t *testing.T) {
	f := setup(t)
	ownerID := f.newUser(t, "bdayowner", false)
	viewerID := f.newUser(t, "bdayviewer", false)

	if rr := patchDetails(t, f, ownerID, `{"first_name":"Nova","last_name":"Ray","date_of_birth":"1994-07-16"}`); rr.Code != http.StatusOK {
		t.Fatalf("update status = %d; body=%s", rr.Code, rr.Body.String())
	}

	owner := profileJSON(t, getProfile(t, f.usersHandler, ownerID, "bdayowner"))
	if owner["date_of_birth"] != "1994-07-16" || owner["birthday_visibility"] != "private" {
		t.Fatalf("owner view = %v, want dob + private", owner)
	}

	other := getProfile(t, f.usersHandler, viewerID, "bdayowner")
	if strings.Contains(other.Body.String(), "date_of_birth") || strings.Contains(other.Body.String(), "birthday_visibility") {
		t.Fatalf("private birthday leaked to another user: %s", other.Body.String())
	}
}

func TestBirthdayVisibility_PublicIsVisibleToOthersAndPersists(t *testing.T) {
	f := setup(t)
	ownerID := f.newUser(t, "bdaypublic", false)
	viewerID := f.newUser(t, "bdaypublicviewer", false)

	rr := patchDetails(t, f, ownerID, `{"first_name":"Nova","last_name":"Ray","date_of_birth":"1994-07-16","birthday_visibility":"public"}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("update status = %d; body=%s", rr.Code, rr.Body.String())
	}

	if got := profileJSON(t, getProfile(t, f.usersHandler, viewerID, "bdaypublic"))["date_of_birth"]; got != "1994-07-16" {
		t.Fatalf("other user dob = %v, want 1994-07-16", got)
	}
	owner := profileJSON(t, getProfile(t, f.usersHandler, ownerID, "bdaypublic"))
	if owner["date_of_birth"] != "1994-07-16" || owner["birthday_visibility"] != "public" {
		t.Fatalf("owner view = %v", owner)
	}

	// Omitting the field on a later update must keep the saved preference.
	if rr := patchDetails(t, f, ownerID, `{"first_name":"Nova","last_name":"Ray","date_of_birth":"1994-07-16"}`); rr.Code != http.StatusOK {
		t.Fatalf("second update status = %d; body=%s", rr.Code, rr.Body.String())
	}
	profile, err := f.usersSvc.GetProfileByID(ownerID)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if profile.BirthdayVisibility != "public" {
		t.Fatalf("visibility = %q, want public", profile.BirthdayVisibility)
	}
}

func TestBirthdayVisibility_RejectsInvalidValue(t *testing.T) {
	f := setup(t)
	userID := f.newUser(t, "bdayinvalid", false)

	rr := patchDetails(t, f, userID, `{"first_name":"Nova","last_name":"Ray","birthday_visibility":"friends"}`)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusBadRequest, rr.Body.String())
	}
}

func TestBirthdayVisibility_UnauthenticatedUpdateRejected(t *testing.T) {
	f := setup(t)
	f.newUser(t, "bdayunauth", false)
	req := httptest.NewRequest(http.MethodPatch, "/api/users/me/profile",
		bytes.NewBufferString(`{"first_name":"A","last_name":"B","birthday_visibility":"public"}`))
	rr := httptest.NewRecorder()
	f.usersHandler.UpdateProfileDetailsHandler(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
