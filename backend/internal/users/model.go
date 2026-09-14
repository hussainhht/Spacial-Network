package users

import (
	"database/sql"
	"time"
)

type User struct {
	ID           int            `db:"id"`
	UUID         string         `db:"uuid"`
	Username     string         `db:"username"`
	Age          int            `db:"age"`
	Gender       string         `db:"gender"`
	FirstName    string         `db:"first_name"`
	LastName     string         `db:"last_name"`
	Email        string         `db:"email"`
	PasswordHash string         `db:"password_hash"`
	ProfilePhoto sql.NullString `db:"profile_photo"` //* sql.NullString is Go’s way to represent a database column that can contain either a string or a NULL
	CreatedAt    time.Time      `db:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at"`
	IsPrivate    bool           `db:"is_private"`
	Nickname     sql.NullString `db:"nickname"`
	AboutMe      sql.NullString `db:"about_me"`
	DateOfBirth  sql.NullString `db:"date_of_birth"`
}

type Profile struct {
	ID           int            `db:"id"`
	UUID         string         `db:"uuid"`
	Username     string         `db:"username"`
	Age          int            `db:"age"`
	Gender       string         `db:"gender"`
	FirstName    string         `db:"first_name"`
	LastName     string         `db:"last_name"`
	Email        string         `db:"email"`
	ProfilePhoto sql.NullString `db:"profile_photo"`
	CreatedAt    time.Time      `db:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at"`
	IsPrivate    bool           `db:"is_private"`
	Nickname     sql.NullString `db:"nickname"`
	AboutMe      sql.NullString `db:"about_me"`
	DateOfBirth  sql.NullString `db:"date_of_birth"`
}

// ProfileResponse is the JSON profile data sent to the frontend.
type ProfileResponse struct {
	ID                 int    `json:"id"`
	UUID               string `json:"uuid,omitempty"`
	Username           string `json:"username"`
	Age                int    `json:"age,omitempty"`
	Gender             string `json:"gender,omitempty"`
	FirstName          string `json:"first_name"`
	LastName           string `json:"last_name"`
	Email              string `json:"email,omitempty"`
	ProfilePhoto       string `json:"profile_photo,omitempty"`
	CreatedAt          string `json:"created_at,omitempty"`
	UpdatedAt          string `json:"updated_at,omitempty"`
	IsPrivate          bool   `json:"is_private"`
	CanViewFullProfile bool   `json:"can_view_full_profile"`
	Nickname           string `json:"nickname,omitempty"`
	AboutMe            string `json:"about_me,omitempty"`
	DateOfBirth        string `json:"date_of_birth,omitempty"`
}

type GetProfileResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message,omitempty"`
	Profile *ProfileResponse `json:"profile,omitempty"`
}

type UpdateProfilePrivacyRequest struct {
	IsPrivate *bool `json:"is_private"`
}

type UpdateProfileDetailsRequest struct {
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Nickname    *string `json:"nickname"`
	AboutMe     *string `json:"about_me"`
	DateOfBirth *string `json:"date_of_birth"`
}

type UpdateProfileDetailsResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message,omitempty"`
	Profile *ProfileResponse `json:"profile,omitempty"`
}

type UpdateProfileAvatarResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message,omitempty"`
	Profile *ProfileResponse `json:"profile,omitempty"`
}

type UpdateProfilePrivacyResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message,omitempty"`
	IsPrivate bool   `json:"is_private"`
}

type Handler struct {
	service       *Service
	avatarStorage AvatarStorage
}

// Summary is a lightweight, publicly-safe view of a user for embedding in
// other features' responses (e.g. a post's author).
type Summary struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	ProfilePhoto string `json:"profile_photo,omitempty"`
}
