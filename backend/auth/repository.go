package auth

import (
	"database/sql"
	"time"

	"social/pkg/db/sqlite"
)

// session timeout
var sessionTimeout = 30 * time.Minute

func CreateSession(userID int, token string) error {
	now := time.Now()
	expiresAt := now.Add(sessionTimeout)

	// Check whether this user already has a session
	const checkQuery = `
		SELECT 1
		FROM sessions
		WHERE user_id = ?
		LIMIT 1
	`

	var exists int
	err := sqlite.DB.QueryRow(checkQuery, userID).Scan(&exists)
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

		_, err = sqlite.DB.Exec(updateQuery, token, now, expiresAt, userID)
		return err
	}

	// Insert new session
	const insertQuery = `
		INSERT INTO sessions (user_id, session_token, created_at, expires_at, revoked_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err = sqlite.DB.Exec(insertQuery, userID, token, now, expiresAt, nil)
	return err
}

// UpdateSessionExpiry checks if a session is revoked or expired, and if not,
// extends its expiry time.
func UpdateSessionExpiry(token string) error {
	now := time.Now()
	expiresAt := now.Add(sessionTimeout)

	query := `
		UPDATE sessions
		SET expires_at = ?
		WHERE session_token = ?
		AND revoked_at IS NULL
		AND expires_at > CURRENT_TIMESTAMP
	`
	res, err := sqlite.DB.Exec(query, expiresAt, token)
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

// ValidateSession checks if session is valid and returns userID. If the
// token has already expired (or was revoked), the record is removed from
// the database as a side-effect so that old sessions don't hang around
// forever.
func ValidateSession(token string) (int, error) {
	var userID int

	err := sqlite.DB.QueryRow(`
		SELECT user_id
		FROM sessions
		WHERE session_token = ?
		AND revoked_at IS NULL
		AND expires_at > CURRENT_TIMESTAMP
	`, token).Scan(&userID)
	if err == sql.ErrNoRows {
		// token is not valid; attempt to delete the row
		sqlite.DB.Exec(`
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

// RevokeSession marks a session as revoked (user has logged out). Revoked
// sessions are kept for 30 days before CleanupSessions deletes them.
func RevokeSession(token string) error {
	_, err := sqlite.DB.Exec(`
		UPDATE sessions
		SET revoked_at = CURRENT_TIMESTAMP
		WHERE session_token = ?
	`, token)
	return err
}

// CleanupSessions deletes expired sessions and revoked sessions older than
// 30 days. The caller can choose to run this periodically to keep the table
// small.
func CleanupSessions() (int64, error) {
	res, err := sqlite.DB.Exec(`
		DELETE FROM sessions
		WHERE expires_at <= CURRENT_TIMESTAMP
		   OR (revoked_at IS NOT NULL AND revoked_at <= datetime('now','-30 days'))
	`)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}
