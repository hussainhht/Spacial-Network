package auth_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"social/internal/auth"
	"social/internal/requestctx"
	"social/internal/users"
	"social/tests/testutil"
)

type passwordFixture struct {
	db      *sql.DB
	userID  int
	service *auth.Service
	handler *auth.Handler
}

func setupPasswordFixture(t *testing.T) passwordFixture {
	t.Helper()

	db := testutil.NewTestDB(t)
	userID := testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "passworduser",
		Email:    "password@example.com",
		Password: "current-password",
	})
	usersService := users.NewService(users.NewRepository(db), nil)
	authService := auth.NewService(auth.NewRepository(db, time.Hour), usersService)

	return passwordFixture{
		db:      db,
		userID:  userID,
		service: authService,
		handler: auth.NewHandler(authService, usersService, nil, testCookieName, false, time.Hour),
	}
}

func changePasswordRequest(
	t *testing.T,
	handler *auth.Handler,
	userID *int,
	currentPassword string,
	newPassword string,
) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(auth.ChangePasswordRequest{
		CurrentPassword: currentPassword,
		NewPassword:     newPassword,
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/api/users/me/password", bytes.NewReader(body))
	if userID != nil {
		req = req.WithContext(requestctx.WithUserID(req.Context(), *userID))
	}
	rr := httptest.NewRecorder()
	handler.ChangePasswordHandler(rr, req)
	return rr
}

func TestChangePassword_SuccessReplacesHashAndKeepsSession(t *testing.T) {
	f := setupPasswordFixture(t)

	_, currentSession, err := f.service.Login("passworduser", "current-password")
	if err != nil {
		t.Fatalf("Login before password change: %v", err)
	}

	var oldHash string
	if err := f.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, f.userID).Scan(&oldHash); err != nil {
		t.Fatalf("read old password hash: %v", err)
	}

	rr := changePasswordRequest(t, f.handler, &f.userID, "current-password", "new-password-123")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	responseBody := strings.ToLower(rr.Body.String())
	if strings.Contains(responseBody, "hash") || strings.Contains(responseBody, "current-password") || strings.Contains(responseBody, "new-password-123") {
		t.Fatalf("password response leaked sensitive data: %s", rr.Body.String())
	}

	var newHash string
	if err := f.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, f.userID).Scan(&newHash); err != nil {
		t.Fatalf("read new password hash: %v", err)
	}
	if newHash == oldHash {
		t.Fatal("password hash did not change")
	}

	if _, err := f.service.ValidateSession(currentSession); err != nil {
		t.Fatalf("current session should remain valid: %v", err)
	}
	if _, _, err := f.service.Login("passworduser", "current-password"); !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Fatalf("old password should no longer work, got: %v", err)
	}
	if _, _, err := f.service.Login("passworduser", "new-password-123"); err != nil {
		t.Fatalf("new password should work: %v", err)
	}
}

func TestChangePassword_RejectsIncorrectCurrentPassword(t *testing.T) {
	f := setupPasswordFixture(t)
	rr := changePasswordRequest(t, f.handler, &f.userID, "wrong", "new-password-123")

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnauthorized, rr.Body.String())
	}
	if _, _, err := f.service.Login("passworduser", "current-password"); err != nil {
		t.Fatalf("original password should remain valid: %v", err)
	}
}

func TestChangePassword_RejectsInvalidNewPassword(t *testing.T) {
	f := setupPasswordFixture(t)
	rr := changePasswordRequest(t, f.handler, &f.userID, "current-password", "short")

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusBadRequest, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "at least 8") {
		t.Fatalf("expected password policy error, got: %s", rr.Body.String())
	}
}

func TestChangePassword_RequiresAuthenticatedUser(t *testing.T) {
	f := setupPasswordFixture(t)
	rr := changePasswordRequest(t, f.handler, nil, "current-password", "new-password-123")

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnauthorized, rr.Body.String())
	}
}
