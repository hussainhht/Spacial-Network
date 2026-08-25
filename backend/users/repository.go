package users

import (
	"database/sql"

	"social/pkg/db/sqlite"
	"social/pkg/errs"
)

func UsernameExists(username string) (bool, error) {
	var exists int

	err := sqlite.DB.QueryRow(
		`SELECT 1 FROM users WHERE username = ? LIMIT 1`,
		username,
	).Scan(&exists)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

// EmailExists checks if an email already exists
func EmailExists(email string) (bool, error) {
	var exists int
	err := sqlite.DB.QueryRow(
		`SELECT 1 FROM users WHERE email = ? LIMIT 1`,
		email,
	).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func InsertUser(uuid, username string, age int, gender, firstName, lastName, email, passwordHash string) error {
	query := `
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := sqlite.DB.Exec(
		query,
		uuid,
		username,
		age,
		gender,
		firstName,
		lastName,
		email,
		passwordHash,
	)
	return err
}

// GetCredentials retrieves the user id and stored password hash for a username or email.
func GetCredentials(identifier string) (int, string, error) {
	var id int
	var hashedPassword string

	err := sqlite.DB.QueryRow(`
		SELECT id, password_hash
		FROM users
		WHERE username = ? OR email = ?`,
		identifier,
		identifier,
	).Scan(&id, &hashedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, "", errs.ErrInvalidCredentials
		}
		return 0, "", err
	}

	return id, hashedPassword, nil
}

func GetUsernameByID(userID int) (string, error) {
	var username string

	err := sqlite.DB.QueryRow(`
		SELECT username
		FROM users
		WHERE id = ?
	`, userID).Scan(&username)
	if err != nil {
		return "", err
	}

	return username, nil
}

func GetUserIDByUsername(username string) (int, error) {
	var userID int

	err := sqlite.DB.QueryRow(`
		SELECT id
		FROM users
		WHERE username = ?
	`, username).Scan(&userID)
	if err != nil {
		return 0, err
	}

	return userID, nil
}
