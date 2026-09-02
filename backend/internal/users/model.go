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
}

// ProfileResponse is the JSON profile data sent to the frontend.
type ProfileResponse struct {
	ID           int    `json:"id"`
	UUID         string `json:"uuid"`
	Username     string `json:"username"`
	Age          int    `json:"age"`
	Gender       string `json:"gender"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Email        string `json:"email"`
	ProfilePhoto string `json:"profile_photo,omitempty"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type GetProfileResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message,omitempty"`
	Profile *ProfileResponse `json:"profile,omitempty"`
}

type Handler struct {
	service *Service
}
