package db

import (
	"database/sql"
	"time"

	"social/errs"
	"social/helpers"
)

//commented out user presence for startup testing

// session timeout
var timeout = 30 * time.Minute

// online-offline timeout
// var PresenceTimeout = 30 * time.Second

func UsernameExists(username string) (bool, error) {
	var exists int

	err := Db.QueryRow(
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

// CheckPass retrieves the stored hash and compares it using bcrypt.
// using CheckUserCredentials + helpers.ComparePasswords instead.
func CheckPass(username, pass string) (bool, error) {
	var passHash string

	err := Db.QueryRow(
		`SELECT password_hash FROM users WHERE username = ? LIMIT 1`,
		username,
	).Scan(&passHash)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return helpers.ComparePasswords(passHash, pass), nil
}

// CheckUserCredentials checks username/email and password in DB.
func CheckUserCredentials(identifier, password string) (int, string, error) {
	var id int
	var hashedPassword string

	err := Db.QueryRow(`
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

func CreateUser(uuid, username string, age int, gender, firstName, lastName, email, password string) error {
	hashedPassword, err := helpers.HashPassword(password)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = Db.Exec(
		query,
		uuid,
		username,
		age,
		gender,
		firstName,
		lastName,
		email,
		hashedPassword,
	)
	return err
}

// EmailExists checks if an email already exists
func EmailExists(email string) (bool, error) {
	var exists int
	err := Db.QueryRow(
		`SELECT 1 FROM users WHERE email = ? LIMIT 1`,
		email,
	).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func CreateSession(userID int, token string) error {
	now := time.Now()
	expiresAt := now.Add(timeout)

	// Check whether this user already has a session
	const checkQuery = `
		SELECT 1
		FROM sessions
		WHERE user_id = ?
		LIMIT 1
	`

	var exists int
	err := Db.QueryRow(checkQuery, userID).Scan(&exists)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Update existing session
	if err == nil {
		const updateQuery = `
			UPDATE sessions
			SET session_token = ?, created_at = ?, expires_at = ?, revoked_at = NULL
			WHERE user_id = ?
		`

		_, err = Db.Exec(updateQuery, token, now, expiresAt, userID)
		return err
	}

	// Insert new session
	const insertQuery = `
		INSERT INTO sessions (user_id, session_token, created_at, expires_at, revoked_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err = Db.Exec(insertQuery, userID, token, now, expiresAt, nil)
	return err
}

// func setUserPresence(userID int, isOnline bool) error {
// 	onlineValue := 0
// 	if isOnline {
// 		onlineValue = 1
// 	}

// 	_, err := Db.Exec(`
// 		INSERT INTO user_presence (user_id, is_online, last_seen_at)
// 		VALUES (?, ?, CURRENT_TIMESTAMP)
// 		ON CONFLICT(user_id) DO UPDATE SET
// 			is_online = excluded.is_online,
// 			last_seen_at = CURRENT_TIMESTAMP
// 	`, userID, onlineValue)

// 	return err
// }

// func MarkUserOnline(userID int) error {
// 	return setUserPresence(userID, true)
// }

// func MarkUserOffline(userID int) error {
// 	return setUserPresence(userID, false)
// }

// func MarkUserOnlineByUsername(username string) error {
// 	userID, err := GetUserIDByUsername(username)
// 	if err != nil {
// 		return err
// 	}

// 	return MarkUserOnline(userID)
// }

// func MarkUserOfflineByUsername(username string) error {
// 	userID, err := GetUserIDByUsername(username)
// 	if err != nil {
// 		return err
// 	}

// 	return MarkUserOffline(userID)
// }

// func GetUserPresenceMap() (map[int]bool, error) {
// 	rows, err := Db.Query(`
// 		SELECT user_id, is_online
// 		FROM user_presence
// 	`)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer rows.Close()

// 	presence := make(map[int]bool)
// 	for rows.Next() {
// 		var userID int
// 		var isOnline int

// 		if err := rows.Scan(&userID, &isOnline); err != nil {
// 			return nil, err
// 		}

// 		presence[userID] = isOnline == 1
// 	}

// 	return presence, rows.Err()
// }

// func MarkInactiveUsersOffline(timeout time.Duration) error {
// 	modifier := fmt.Sprintf("-%d seconds", int(timeout/time.Second))

// 	_, err := Db.Exec(`
// 		UPDATE user_presence
// 		SET is_online = 0, last_seen_at = CURRENT_TIMESTAMP
// 		WHERE is_online = 1
// 		  AND (
// 			last_seen_at <= datetime('now', ?)
// 			OR NOT EXISTS (
// 				SELECT 1
// 				FROM sessions
// 				WHERE sessions.user_id = user_presence.user_id
// 				  AND revoked_at IS NULL
// 				  AND expires_at > CURRENT_TIMESTAMP
// 			)
// 		  )
// 	`, modifier)

// 	return err
// }

// check if revoked or expired, and if not, update the expiry time to extend the session
func UpdateSessionExpiry(token string) error {
	now := time.Now()
	expiresAt := now.Add(timeout)

	query := `
		UPDATE sessions
		SET expires_at = ?
		WHERE session_token = ?
		AND revoked_at IS NULL
		AND expires_at > CURRENT_TIMESTAMP
		AND expires_at > CURRENT_TIMESTAMP
	`
	res, err := Db.Exec(query, expiresAt, token)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows // session is not valid (revoked or expired)
	}

	return nil
}

// func ListUsers() ([]models.User, error) {
// 	query := `SELECT id, uuid, username, age, gender, first_name, last_name, email, password_hash, created_at, updated_at FROM users`
// 	rows, err := Db.Query(query)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer rows.Close()

// 	users := []models.User{}
// 	for rows.Next() {
// 		var u models.User
// 		if err := rows.Scan(&u.ID, &u.UUID, &u.Username, &u.Age, &u.Gender, &u.FirstName, &u.LastName, &u.Email, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt); err != nil {
// 			return nil, err
// 		}
// 		users = append(users, u)
// 	}
// 	return users, nil
// }

// ValidateSession checks if session is valid and returns userID.  If the
// token has already expired (or was revoked), the record is removed from the
// database as a side‑effect so that old sessions don’t hang around forever.
func ValidateSession(token string) (int, error) {
	var userID int

	err := Db.QueryRow(`
		SELECT user_id
		FROM sessions
		WHERE session_token = ?
		AND revoked_at IS NULL
		AND expires_at > CURRENT_TIMESTAMP
	`, token).Scan(&userID)
	if err == sql.ErrNoRows {
		// token is not valid; attempt to delete the row
		Db.Exec(`
			DELETE FROM sessions
			WHERE session_token = ?
			AND (expires_at <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL)
		`, token)
		return 0, err
	}
	if err != nil {
		return 0, err
	}

	return userID, nil
}

// RevokeSession marks a session as revoked (user has logged out)
// for a duration of 30 days, after which it will be automatically deleted by CleanupSessions.
func RevokeSession(token string) error {
	_, err := Db.Exec(`
		UPDATE sessions
		SET revoked_at = CURRENT_TIMESTAMP
		WHERE session_token = ?
	`, token)
	return err
}

// CleanupSessions performs a one‑time cleanup of old sessions.  It deletes
// any row that is already expired, and also clean up revoked sessions older
// than a 30 days.  The caller can choose to run this
// periodically to keep the table small.
func CleanupSessions() (int64, error) {
	res, err := Db.Exec(`
		DELETE FROM sessions
		WHERE expires_at <= CURRENT_TIMESTAMP
		   OR (revoked_at IS NOT NULL AND revoked_at <= datetime('now','-30 days'))
	`)
	if err != nil {
		return 0, err
	}

	//PART OF USER PRESENCE LOGIC
	// if err := MarkInactiveUsersOffline(PresenceTimeout); err != nil {
	// 	return 0, err
	// }

	return res.RowsAffected()
}

func GetUsernameByID(userID int) (string, error) {
	var username string

	err := Db.QueryRow(`
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

	err := Db.QueryRow(`
		SELECT id
		FROM users
		WHERE username = ?
	`, username).Scan(&userID)
	if err != nil {
		return 0, err
	}

	return userID, nil
}
