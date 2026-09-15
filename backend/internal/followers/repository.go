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

const (
	minRecommendationLimit = 3
	maxRecommendationLimit = 4
)

func (r *Repository) GetRecommendations(viewerID, limit int) ([]Recommendation, error) {
	if limit < minRecommendationLimit {
		limit = minRecommendationLimit
	} else if limit > maxRecommendationLimit {
		limit = maxRecommendationLimit
	}

	rows, err := r.db.Query(`
		WITH mutual_candidates AS (
			SELECT
				c.id,
				c.username,
				c.first_name,
				c.last_name,
				COALESCE(c.profile_photo, '') AS profile_photo,
				COUNT(m.id) AS mutual_count,
				COALESCE(GROUP_CONCAT(m.username, char(31)), '') AS mutual_handles,
				0 AS source_rank,
				0 AS activity_count
			FROM followers current_following
			JOIN followers mutual_following
				ON mutual_following.follower_id = current_following.followed_id
			JOIN users c ON c.id = mutual_following.followed_id
			JOIN users m ON m.id = current_following.followed_id
			WHERE current_following.follower_id = ?
				AND c.id != ?
				AND c.is_private = 0
				AND NOT EXISTS (
					SELECT 1 FROM followers existing_follow
					WHERE existing_follow.follower_id = ? AND existing_follow.followed_id = c.id
				)
			GROUP BY c.id, c.username, c.first_name, c.last_name, c.profile_photo
		),
		fallback_candidates AS (
			SELECT
				u.id,
				u.username,
				u.first_name,
				u.last_name,
				COALESCE(u.profile_photo, '') AS profile_photo,
				0 AS mutual_count,
				'' AS mutual_handles,
				1 AS source_rank,
				COUNT(p.id) AS activity_count
			FROM users u
			LEFT JOIN posts p
				ON p.user_id = u.id
				AND p.group_id IS NULL
				AND p.visibility = 'public'
			WHERE u.id != ?
				AND u.is_private = 0
				AND NOT EXISTS (
					SELECT 1 FROM followers existing_follow
					WHERE existing_follow.follower_id = ? AND existing_follow.followed_id = u.id
				)
				AND NOT EXISTS (
					SELECT 1 FROM mutual_candidates mutual
					WHERE mutual.id = u.id
				)
			GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_photo
		),
		ranked_candidates AS (
			SELECT * FROM mutual_candidates
			UNION ALL
			SELECT * FROM fallback_candidates
		)
		SELECT id, username, first_name, last_name, profile_photo, mutual_count, mutual_handles
		FROM ranked_candidates
		ORDER BY source_rank ASC, mutual_count DESC, activity_count DESC, username ASC
		LIMIT ?
	`,
		viewerID, viewerID, viewerID,
		viewerID, viewerID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recommendations := make([]Recommendation, 0, limit)
	for rows.Next() {
		var recommendation Recommendation
		var firstName, lastName, rawPhoto, rawMutualHandles string
		if err := rows.Scan(
			&recommendation.ID,
			&recommendation.Username,
			&firstName,
			&lastName,
			&rawPhoto,
			&recommendation.MutualCount,
			&rawMutualHandles,
		); err != nil {
			return nil, err
		}

		recommendation.Name = strings.TrimSpace(firstName + " " + lastName)
		if recommendation.Name == "" {
			recommendation.Name = recommendation.Username
		}
		recommendation.AvatarURL = normalizeProfilePhotoURL(rawPhoto)
		if rawMutualHandles != "" {
			recommendation.MutualPreview = strings.Split(rawMutualHandles, string(rune(31)))
			if len(recommendation.MutualPreview) > 2 {
				recommendation.MutualPreview = recommendation.MutualPreview[:2]
			}
		} else {
			recommendation.MutualPreview = []string{}
		}
		recommendation.IsFollowing = false

		recommendations = append(recommendations, recommendation)
	}

	return recommendations, rows.Err()
}

func normalizeProfilePhotoURL(photo string) string {
	photo = strings.TrimSpace(photo)
	if photo == "" {
		return ""
	}
	if strings.HasPrefix(photo, "/uploads/") || strings.HasPrefix(photo, "http://") || strings.HasPrefix(photo, "https://") {
		return photo
	}
	return "/uploads/" + strings.TrimPrefix(photo, "/")
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

// AcceptFollowRequest activates requestID and returns the requester's user
// ID, so the caller can notify them that their request was accepted.
func (r *Repository) AcceptFollowRequest(requestID, targetID int) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
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
			return 0, ErrFollowRequestNotFound
		}
		return 0, err
	}

	if status != FollowRequestStatusPending {
		return 0, ErrFollowRequestNotPending
	}

	_, err = tx.Exec(`
		UPDATE follow_requests
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, FollowRequestStatusAccepted, requestID)
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(`
		INSERT INTO followers (follower_id, followed_id)
		VALUES (?, ?)
		ON CONFLICT(follower_id, followed_id) DO NOTHING
	`, requesterID, targetID)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return requesterID, nil
}

// DeclineFollowRequest marks requestID declined and returns the requester's
// user ID, so the caller can let them know without persisting a
// notification for it (see followers.Service.DeclineFollowRequest).
func (r *Repository) DeclineFollowRequest(requestID, targetID int) (int, error) {
	var requesterID int
	var status string

	err := r.db.QueryRow(`
		SELECT requester_id, status
		FROM follow_requests
		WHERE id = ? AND target_id = ?
	`, requestID, targetID).Scan(&requesterID, &status)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, ErrFollowRequestNotFound
		}
		return 0, err
	}

	if status != FollowRequestStatusPending {
		return 0, ErrFollowRequestNotPending
	}

	_, err = r.db.Exec(`
		UPDATE follow_requests
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, FollowRequestStatusDeclined, requestID)
	if err != nil {
		return 0, err
	}

	return requesterID, nil
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
