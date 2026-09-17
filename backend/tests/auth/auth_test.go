// Package auth_test covers user registration and password hashing:
// social/internal/auth (validation, service) together with social/internal/users
// (CreateUser, CheckCredentials) since registration/credential-checking logic
// lives there.
package auth_test

import (
	"strings"
	"testing"
	"time"

	"social/internal/auth"
	"social/internal/users"
	"social/tests/testutil"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func validRegisterRequest() auth.RegisterRequest {
	return auth.RegisterRequest{
		Username:    "janedoe",
		FirstName:   "Jane",
		LastName:    "Doe",
		Email:       "jane@example.com",
		Password:    "supersecret1",
		Gender:      "female",
		DateOfBirth: "1994-06-15",
	}
}

func TestValidateRegisterRequest_MissingFields(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*auth.RegisterRequest)
		wantErr bool
	}{
		{"valid request", func(r *auth.RegisterRequest) {}, false},
		{"missing email", func(r *auth.RegisterRequest) { r.Email = "" }, true},
		{"invalid email format", func(r *auth.RegisterRequest) { r.Email = "not-an-email" }, true},
		{"missing password", func(r *auth.RegisterRequest) { r.Password = "" }, true},
		{"password too short", func(r *auth.RegisterRequest) { r.Password = "short" }, true},
		{"missing first name", func(r *auth.RegisterRequest) { r.FirstName = "" }, true},
		{"missing last name", func(r *auth.RegisterRequest) { r.LastName = "" }, true},
		{"missing username", func(r *auth.RegisterRequest) { r.Username = "" }, true},
		{"invalid gender", func(r *auth.RegisterRequest) { r.Gender = "other" }, true},
		{"missing date of birth", func(r *auth.RegisterRequest) { r.DateOfBirth = "" }, true},
		{"invalid date of birth format", func(r *auth.RegisterRequest) { r.DateOfBirth = "15-06-1994" }, true},
		{"date of birth in the future", func(r *auth.RegisterRequest) { r.DateOfBirth = "2999-01-01" }, true},
		{"date of birth yields age too large", func(r *auth.RegisterRequest) { r.DateOfBirth = "1800-01-01" }, true},
		{"date of birth yields age zero", func(r *auth.RegisterRequest) { r.DateOfBirth = time.Now().Format("2006-01-02") }, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validRegisterRequest()
			tt.mutate(&req)

			err := auth.ValidateRegisterRequest(&req)
			if tt.wantErr && err == nil {
				t.Fatalf("expected validation error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestRegister_ValidInput_PersistsUser(t *testing.T) {
	db := testutil.NewTestDB(t)
	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	req := validRegisterRequest()
	if err := auth.ValidateRegisterRequest(&req); err != nil {
		t.Fatalf("validate register request: %v", err)
	}

	if _, err := svc.CreateUser(uuid.NewString(), req.Username, req.Age, req.DateOfBirth, req.Gender, req.FirstName, req.LastName, req.Email, req.Password, ""); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	id, err := repo.GetUserIDByUsername(req.Username)
	if err != nil {
		t.Fatalf("expected user to be persisted, lookup failed: %v", err)
	}

	profile, err := repo.GetProfileByID(id)
	if err != nil {
		t.Fatalf("GetProfileByID: %v", err)
	}
	if profile.Email != req.Email {
		t.Errorf("email = %q, want %q", profile.Email, req.Email)
	}
	if profile.Username != req.Username {
		t.Errorf("username = %q, want %q", profile.Username, req.Username)
	}
}

func TestRegister_DuplicateEmail_Rejected(t *testing.T) {
	db := testutil.NewTestDB(t)
	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	if _, err := svc.CreateUser(uuid.NewString(), "first", 25, "1998-01-01", "male", "First", "User", "dup@example.com", "password123", ""); err != nil {
		t.Fatalf("seed first user: %v", err)
	}

	exists, err := svc.EmailExists("dup@example.com")
	if err != nil {
		t.Fatalf("EmailExists: %v", err)
	}
	if !exists {
		t.Fatalf("expected EmailExists to report true for an already-registered email")
	}

	// A second CreateUser with the same email must fail at the DB layer
	// (UNIQUE constraint on users.email), mirroring what the handler guards
	// against via EmailExists before ever calling CreateUser.
	_, err = svc.CreateUser(uuid.NewString(), "second", 25, "1998-01-01", "male", "Second", "User", "dup@example.com", "password123", "")
	if err == nil {
		t.Fatalf("expected duplicate email registration to fail, got nil error")
	}
}

func TestRegister_DuplicateUsername_Rejected(t *testing.T) {
	db := testutil.NewTestDB(t)
	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	if _, err := svc.CreateUser(uuid.NewString(), "dupname", 25, "1998-01-01", "male", "First", "User", "a@example.com", "password123", ""); err != nil {
		t.Fatalf("seed first user: %v", err)
	}

	exists, err := svc.UsernameExists("dupname")
	if err != nil {
		t.Fatalf("UsernameExists: %v", err)
	}
	if !exists {
		t.Fatalf("expected UsernameExists to report true for an already-registered username")
	}

	_, err = svc.CreateUser(uuid.NewString(), "dupname", 25, "1998-01-01", "male", "Second", "User", "b@example.com", "password123", "")
	if err == nil {
		t.Fatalf("expected duplicate username registration to fail, got nil error")
	}
}

func TestPasswordHashing_NeverStoredPlaintext(t *testing.T) {
	db := testutil.NewTestDB(t)
	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	const plaintext = "supersecret1"
	if _, err := svc.CreateUser(uuid.NewString(), "hashcheck", 25, "1998-01-01", "male", "Hash", "Check", "hash@example.com", plaintext, ""); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	_, hash, err := repo.GetCredentials("hashcheck")
	if err != nil {
		t.Fatalf("GetCredentials: %v", err)
	}

	if hash == plaintext {
		t.Fatalf("password hash equals plaintext password - password is being stored unhashed")
	}
	if strings.Contains(hash, plaintext) {
		t.Fatalf("stored hash contains the plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)); err != nil {
		t.Fatalf("stored hash does not verify against the original password: %v", err)
	}
}

func TestCheckCredentials_CorrectAndWrongPassword(t *testing.T) {
	db := testutil.NewTestDB(t)
	repo := users.NewRepository(db)
	svc := users.NewService(repo, nil)

	if _, err := svc.CreateUser(uuid.NewString(), "credcheck", 25, "1998-01-01", "male", "Cred", "Check", "cred@example.com", "correctpassword", ""); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	t.Run("correct password succeeds", func(t *testing.T) {
		id, err := svc.CheckCredentials("credcheck", "correctpassword")
		if err != nil {
			t.Fatalf("expected success, got error: %v", err)
		}
		if id <= 0 {
			t.Fatalf("expected a positive user id, got %d", id)
		}
	})

	t.Run("wrong password fails", func(t *testing.T) {
		if _, err := svc.CheckCredentials("credcheck", "wrongpassword"); err != users.ErrInvalidCredentials {
			t.Fatalf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("unknown identifier fails", func(t *testing.T) {
		if _, err := svc.CheckCredentials("nobodyhere", "whatever"); err != users.ErrInvalidCredentials {
			t.Fatalf("expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("login by email also works", func(t *testing.T) {
		id, err := svc.CheckCredentials("cred@example.com", "correctpassword")
		if err != nil {
			t.Fatalf("expected success logging in by email, got error: %v", err)
		}
		if id <= 0 {
			t.Fatalf("expected a positive user id, got %d", id)
		}
	})
}
