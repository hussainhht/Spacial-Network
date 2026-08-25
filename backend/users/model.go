package users

import (
	"time"
)

type User struct {
	ID           int       `db:"id"`
	UUID         string    `db:"uuid"`
	Username     string    `db:"username"`
	Age          int       `db:"age"`
	Gender       string    `db:"gender"`
	FirstName    string    `db:"first_name"`
	LastName     string    `db:"last_name"`
	Email        string    `db:"email"`
	PasswordHash string    `db:"password_hash"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}
