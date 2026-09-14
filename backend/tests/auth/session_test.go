// Package auth_test (session_test.go) covers login, the session lifecycle,
// and the SessionMiddleware cookie gate: social/internal/auth (Service,
// Repository) and social/internal/middleware.
package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"social/internal/auth"
	"social/internal/middleware"
	"social/internal/requestctx"
	"social/internal/users"
	"social/tests/testutil"
)

const testCookieName = "session_token"

func setupAuth(t *testing.T) (*auth.Service, int) {
	t.Helper()
	db := testutil.NewTestDB(t)

	userID := testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "loginuser",
		Email:    "login@example.com",
		Password: "correctpassword",
	})

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, nil)
	authRepo := auth.NewRepository(db, time.Hour)
	authSvc := auth.NewService(authRepo, usersSvc)

	return authSvc, userID
}

func TestLogin_CorrectCredentials_CreatesSession(t *testing.T) {
	authSvc, wantID := setupAuth(t)

	id, token, err := authSvc.Login("loginuser", "correctpassword")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if id != wantID {
		t.Errorf("user id = %d, want %d", id, wantID)
	}
	if token == "" {
		t.Fatalf("expected a non-empty session token")
	}

	// The session must actually validate.
	validatedID, err := authSvc.ValidateSession(token)
	if err != nil {
		t.Fatalf("ValidateSession on freshly issued token: %v", err)
	}
	if validatedID != wantID {
		t.Errorf("validated session user id = %d, want %d", validatedID, wantID)
	}
}

func TestLogin_WrongPassword_NoSessionCreated(t *testing.T) {
	authSvc, _ := setupAuth(t)

	_, token, err := authSvc.Login("loginuser", "wrongpassword")
	if err != auth.ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
	if token != "" {
		t.Errorf("expected no token to be issued on failed login, got %q", token)
	}
}

func TestLogin_UnknownEmail_Fails(t *testing.T) {
	authSvc, _ := setupAuth(t)

	if _, _, err := authSvc.Login("nobody@example.com", "whatever"); err != auth.ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogout_InvalidatesSession(t *testing.T) {
	authSvc, _ := setupAuth(t)

	_, token, err := authSvc.Login("loginuser", "correctpassword")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	if err := authSvc.Logout(token); err != nil {
		t.Fatalf("Logout: %v", err)
	}

	if _, err := authSvc.ValidateSession(token); err == nil {
		t.Fatalf("expected ValidateSession to fail after logout, got nil error")
	}
}

func TestSessionMiddleware_ValidCookie_Passes(t *testing.T) {
	authSvc, wantID := setupAuth(t)

	_, token, err := authSvc.Login("loginuser", "correctpassword")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	var sawUserID int
	var sawOK bool
	handler := middleware.SessionMiddleware(authSvc, testCookieName)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawUserID, sawOK = requestctx.UserID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.AddCookie(&http.Cookie{Name: testCookieName, Value: token})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	if !sawOK {
		t.Fatalf("expected downstream handler to see a userID in context")
	}
	if sawUserID != wantID {
		t.Errorf("downstream userID = %d, want %d", sawUserID, wantID)
	}
}

func TestSessionMiddleware_MissingCookie_Rejected(t *testing.T) {
	authSvc, _ := setupAuth(t)

	called := false
	handler := middleware.SessionMiddleware(authSvc, testCookieName)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
	if called {
		t.Fatalf("downstream handler must not run when the session cookie is missing")
	}
}

func TestSessionMiddleware_InvalidCookie_Rejected(t *testing.T) {
	authSvc, _ := setupAuth(t)

	called := false
	handler := middleware.SessionMiddleware(authSvc, testCookieName)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.AddCookie(&http.Cookie{Name: testCookieName, Value: "not-a-real-token"})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
	if called {
		t.Fatalf("downstream handler must not run for an invalid session token")
	}
}

func TestSessionMiddleware_RevokedCookie_Rejected(t *testing.T) {
	authSvc, _ := setupAuth(t)

	_, token, err := authSvc.Login("loginuser", "correctpassword")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if err := authSvc.Logout(token); err != nil {
		t.Fatalf("Logout: %v", err)
	}

	called := false
	handler := middleware.SessionMiddleware(authSvc, testCookieName)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.AddCookie(&http.Cookie{Name: testCookieName, Value: token})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
	if called {
		t.Fatalf("downstream handler must not run for a logged-out (revoked) session")
	}
}

func TestSessionMiddleware_ExpiredSession_Rejected(t *testing.T) {
	db := testutil.NewTestDB(t)
	testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "expireduser",
		Email:    "expired@example.com",
		Password: "correctpassword",
	})

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, nil)
	authRepo := auth.NewRepository(db, time.Hour)
	authSvc := auth.NewService(authRepo, usersSvc)

	_, token, err := authSvc.Login("expireduser", "correctpassword")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	// Simulate time having passed by pushing the session's expiry into the
	// past directly, using SQLite's own date function so the stored value's
	// format matches what expires_at > CURRENT_TIMESTAMP compares against.
	if _, err := db.Exec(`UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE session_token = ?`, token); err != nil {
		t.Fatalf("force-expire session: %v", err)
	}

	called := false
	handler := middleware.SessionMiddleware(authSvc, testCookieName)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.AddCookie(&http.Cookie{Name: testCookieName, Value: token})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
	if called {
		t.Fatalf("downstream handler must not run for an expired session")
	}
}
