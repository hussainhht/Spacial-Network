package followers

import (
	"database/sql"
	"errors"
	"strings"

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

func (r *Repository) FollowUser(followerID, followedID int) (int64, error) {
	var followID int64

	err := r.db.QueryRow(`
		INSERT INTO followers (follower_id, followed_id)
		VALUES (?, ?)
		RETURNING id
	`, followerID, followedID).Scan(&followID)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			return 0, ErrAlreadyFollowing
		}

		return 0, err
	}

	return followID, nil
}

func (r *Repository) UnfollowUser(followerID, followedID int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		DELETE FROM followers
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID); err != nil {
		return err
	}

	// followerID may have been on the custom-visibility allowed-viewer list
	// of posts belonging to followedID; once they're no longer a follower
	// they lose access, so drop those grants too.
	if _, err := tx.Exec(`
		DELETE FROM post_allowed_viewers
		WHERE user_id = ?
			AND post_id IN (SELECT id FROM posts WHERE user_id = ?)
	`, followerID, followedID); err != nil {
		return err
	}

	return tx.Commit()
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

func (r *Repository) HasPendingFollowRequest(requesterID, targetID int) (bool, error) {
	var exists int

	err := r.db.QueryRow(`
		SELECT 1
		FROM follow_requests
		WHERE requester_id = ? AND target_id = ? AND status = ?
		LIMIT 1
	`, requesterID, targetID, FollowRequestStatusPending).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

// FilterFollowerIDs returns the subset of candidateIDs that currently
// follow followedID.
func (r *Repository) FilterFollowerIDs(followedID int, candidateIDs []int) ([]int, error) {
	if len(candidateIDs) == 0 {
		return []int{}, nil
	}

	placeholders := make([]string, len(candidateIDs))
	args := make([]any, 0, len(candidateIDs)+1)
	args = append(args, followedID)
	for i, id := range candidateIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	rows, err := r.db.Query(`
		SELECT follower_id FROM followers
		WHERE followed_id = ? AND follower_id IN (`+strings.Join(placeholders, ",")+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []int{}
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ids, nil
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

func (r *Repository) GetEligibleChatContacts(userID int, search string, contactID int, limit, offset int) ([]UserSummary, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	search = strings.TrimSpace(search)
	like := "%" + escapeLikePattern(search) + "%"

	rows, err := r.db.Query(`
		SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		FROM users u
		WHERE u.id != ? AND (
			u.id IN (SELECT followed_id FROM followers WHERE follower_id = ?)
			OR
			u.id IN (SELECT follower_id FROM followers WHERE followed_id = ?)
		)
		AND (
			? = 0 OR u.id = ?
		)
		AND (
			? = '' OR
			LOWER(u.username) LIKE LOWER(?) ESCAPE '\' OR
			LOWER(u.first_name) LIKE LOWER(?) ESCAPE '\' OR
			LOWER(u.last_name) LIKE LOWER(?) ESCAPE '\'
		)
		ORDER BY u.first_name ASC, u.last_name ASC
		LIMIT ? OFFSET ?
	`, userID, userID, userID, contactID, contactID, search, like, like, like, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUserSummaries(rows)
}

func escapeLikePattern(s string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(s)
}

func (r *Repository) CreateFollowRequest(requesterID, targetID int) (int64, error) {
	var requestID int64

	err := r.db.QueryRow(`
		INSERT INTO follow_requests (requester_id, target_id, status)
		VALUES (?, ?, ?)
		ON CONFLICT(requester_id, target_id) DO UPDATE SET
			status = excluded.status, 
			updated_at = CURRENT_TIMESTAMP, 
			created_at = CURRENT_TIMESTAMP
		WHERE follow_requests.status != ?
		RETURNING id
		`, requesterID, targetID, FollowRequestStatusPending, FollowRequestStatusPending).Scan(&requestID)
	if err == sql.ErrNoRows {
		return 0, ErrFollowRequestAlreadyPending
	}
	if err != nil {
		return 0, err
	}

	return requestID, nil
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
