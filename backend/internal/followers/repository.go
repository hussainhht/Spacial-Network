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

func (r *Repository) CreateFollowRequest(requesterID, targetID int) error {
	result, err := r.db.Exec(`
		INSERT INTO follow_requests (requester_id, target_id, status)
		VALUES (?, ?, ?)
		ON CONFLICT(requester_id, target_id) DO UPDATE SET
			status = excluded.status, 
			updated_at = CURRENT_TIMESTAMP, 
			created_at = CURRENT_TIMESTAMP
		WHERE follow_requests.status != ?
		`, requesterID, targetID, FollowRequestStatusPending, FollowRequestStatusPending)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrFollowRequestAlreadyPending
	}

	return nil
}

func (r *Repository) GetPendingFollowRequests(targetID int) ([]FollowRequestWithRequester, error) {
	rows, err := r.db.Query(`
		select fr.id, u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, ''), fr.status, fr.created_at, fr.updated_at
		from follow_requests fr
		join users u ON u.id = fr.requester_id
		where fr.target_id = ? and fr.status = ?
		order by fr.created_at DESC, fr.id DESC
	`, targetID, FollowRequestStatusPending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := []FollowRequestWithRequester{}

	for rows.Next() {
		var req FollowRequestWithRequester
		var profilePhoto string

		if err := rows.Scan(
			&req.ID,
			&req.Requester.ID,
			&req.Requester.Username,
			&req.Requester.FirstName,
			&req.Requester.LastName,
			&profilePhoto,
			&req.Status,
			&req.CreatedAt,
			&req.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if profilePhoto != "" {
			req.Requester.ProfilePhoto = "/uploads/" + profilePhoto
		}
		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return requests, nil
}

func (r *Repository) AcceptFollowRequest(requestID, targetID int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var requesterID int
	var status string

	err = tx.QueryRow(`
		SELECT requester_id, status
		FROM follow_requests
		WHERE id = ? AND target_id = ?
	`, requestID, targetID).Scan(&requesterID, &status)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrFollowRequestNotFound
		}
		return err
	}

	if status != FollowRequestStatusPending {
		return ErrFollowRequestNotPending
	}

	_, err = tx.Exec(`
		UPDATE follow_requests
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, FollowRequestStatusAccepted, requestID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO followers (follower_id, followed_id)
		VALUES (?, ?)
		ON CONFLICT(follower_id, followed_id) DO NOTHING
	`, requesterID, targetID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *Repository) DeclineFollowRequest(requestID, targetID int) error {
	var status string

	err := r.db.QueryRow(`
		SELECT status
		FROM follow_requests
		WHERE id = ? AND target_id = ?
	`, requestID, targetID).Scan(&status)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrFollowRequestNotFound
		}
		return err
	}

	if status != FollowRequestStatusPending {
		return ErrFollowRequestNotPending
	}

	_, err = r.db.Exec(`
		UPDATE follow_requests
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, FollowRequestStatusDeclined, requestID)
	return err
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
