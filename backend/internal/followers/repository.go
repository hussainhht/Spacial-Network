package followers

import (
	"database/sql"
	"errors"

	"github.com/mattn/go-sqlite3"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) FollowUser(followerID, followedID int) error {
	_, err := r.db.Exec(`
		INSERT INTO followers (follower_id, followed_id)
		VALUES (?, ?)
	`, followerID, followedID)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			return ErrAlreadyFollowing
		}

		return err
	}

	return nil
}

func (r *Repository) UnfollowUser(followerID, followedID int) error {
	_, err := r.db.Exec(`
		DELETE FROM followers
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID)
	return err
}

func (r *Repository) IsFollowing(followerID, followedID int) (bool, error) {
	var exists int

	err := r.db.QueryRow(`
		SELECT 1
		FROM followers
		WHERE follower_id = ? AND followed_id = ?
		LIMIT 1
	`, followerID, followedID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

func (r *Repository) GetFollowers(userID int) ([]UserSummary, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		FROM followers f
		JOIN users u ON u.id = f.follower_id
		WHERE f.followed_id = ?
		ORDER BY f.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUserSummaries(rows)
}

func (r *Repository) GetFollowing(userID int) ([]UserSummary, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		FROM followers f
		JOIN users u ON u.id = f.followed_id
		WHERE f.follower_id = ?
		ORDER BY f.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUserSummaries(rows)
}

func (r *Repository) HasFollowRelationship(userA, userB int) (bool, error) {
	var exists int

	err := r.db.QueryRow(`
		SELECT 1
		FROM followers
		WHERE (follower_id = ? AND followed_id = ?)
		   OR (follower_id = ? AND followed_id = ?)
		LIMIT 1
	`, userA, userB, userB, userA).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

func (r *Repository) GetEligibleChatContacts(userID int) ([]UserSummary, error) {
	rows, err := r.db.Query(`
		SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		FROM users u
		WHERE u.id != ? AND (
			u.id IN (SELECT followed_id FROM followers WHERE follower_id = ?)
			OR
			u.id IN (SELECT follower_id FROM followers WHERE followed_id = ?)
		)
		ORDER BY u.first_name ASC, u.last_name ASC
	`, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUserSummaries(rows)
}

func scanUserSummaries(rows *sql.Rows) ([]UserSummary, error) {
	users := []UserSummary{}

	for rows.Next() {
		var user UserSummary
		var profilePhoto string

		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.FirstName,
			&user.LastName,
			&profilePhoto,
		); err != nil {
			return nil, err
		}

		if profilePhoto != "" {
			user.ProfilePhoto = "/uploads/" + profilePhoto
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
