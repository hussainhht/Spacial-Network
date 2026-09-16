package search

import (
	"database/sql"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func escapeLikePattern(s string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(s)
}

func normalizePhotoURL(photo string) string {
	photo = strings.TrimSpace(photo)
	if photo == "" {
		return ""
	}
	if strings.HasPrefix(photo, "/uploads/") || strings.HasPrefix(photo, "/image/") || strings.HasPrefix(photo, "http://") || strings.HasPrefix(photo, "https://") {
		return photo
	}
	return "/uploads/" + strings.TrimPrefix(photo, "/")
}

func makeSnippet(content string, maxLen int) string {
	content = strings.TrimSpace(content)
	runes := []rune(content)
	if len(runes) <= maxLen {
		return content
	}
	return string(runes[:maxLen]) + "..."
}

func (r *Repository) SearchUsers(viewerID int, query string, limit int) ([]UserResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []UserResult{}, nil
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	likePattern := "%" + escapeLikePattern(query) + "%"
	prefixPattern := escapeLikePattern(query) + "%"

	rows, err := r.db.Query(`
		SELECT
			u.id,
			u.username,
			u.first_name,
			u.last_name,
			COALESCE(u.profile_photo, ''),
			u.is_private,
			EXISTS(SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = u.id) AS is_following
		FROM users u
		WHERE u.id != ?
		  AND (
		      LOWER(u.username) LIKE LOWER(?) ESCAPE '\'
		   OR LOWER(u.first_name) LIKE LOWER(?) ESCAPE '\'
		   OR LOWER(u.last_name) LIKE LOWER(?) ESCAPE '\'
		  )
		ORDER BY
		  CASE WHEN LOWER(u.username) = LOWER(?) THEN 0
		       WHEN LOWER(u.username) LIKE LOWER(?) ESCAPE '\' THEN 1
		       ELSE 2
		  END,
		  u.username ASC
		LIMIT ?
	`, viewerID, viewerID, likePattern, likePattern, likePattern, query, prefixPattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]UserResult, 0)
	for rows.Next() {
		var u UserResult
		var rawPhoto string
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&u.FirstName,
			&u.LastName,
			&rawPhoto,
			&u.IsPrivate,
			&u.IsFollowing,
		); err != nil {
			return nil, err
		}
		u.ProfilePhoto = normalizePhotoURL(rawPhoto)
		results = append(results, u)
	}

	return results, rows.Err()
}

func (r *Repository) SearchGroups(viewerID int, query string, limit int) ([]GroupResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []GroupResult{}, nil
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	likePattern := "%" + escapeLikePattern(query) + "%"
	prefixPattern := escapeLikePattern(query) + "%"

	rows, err := r.db.Query(`
		SELECT
			g.id,
			g.title,
			g.description,
			COALESCE(g.group_photo, ''),
			(SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
			COALESCE((SELECT gm.role FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?), '') AS membership_role
		FROM groups g
		WHERE (
			LOWER(g.title) LIKE LOWER(?) ESCAPE '\'
		   OR LOWER(g.description) LIKE LOWER(?) ESCAPE '\'
		)
		AND (
			g.privacy = 'public'
			OR EXISTS (
				SELECT 1 FROM group_members gm
				WHERE gm.group_id = g.id AND gm.user_id = ?
			)
		)
		ORDER BY
		  CASE WHEN LOWER(g.title) = LOWER(?) THEN 0
		       WHEN LOWER(g.title) LIKE LOWER(?) ESCAPE '\' THEN 1
		       ELSE 2
		  END,
		  member_count DESC,
		  g.id DESC
		LIMIT ?
	`, viewerID, likePattern, likePattern, viewerID, query, prefixPattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]GroupResult, 0)
	for rows.Next() {
		var g GroupResult
		var rawPhoto string
		if err := rows.Scan(
			&g.ID,
			&g.Title,
			&g.Description,
			&rawPhoto,
			&g.MemberCount,
			&g.MembershipRole,
		); err != nil {
			return nil, err
		}
		g.GroupPhoto = normalizePhotoURL(rawPhoto)
		results = append(results, g)
	}

	return results, rows.Err()
}

func (r *Repository) SearchPosts(viewerID int, query string, limit int) ([]PostResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []PostResult{}, nil
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	likePattern := "%" + escapeLikePattern(query) + "%"

	rows, err := r.db.Query(`
		SELECT
			p.id,
			p.title,
			p.content,
			p.user_id,
			u.username,
			COALESCE(u.profile_photo, ''),
			p.group_id,
			COALESCE(g.title, ''),
			p.created_at
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN groups g ON g.id = p.group_id
		WHERE (
			p.user_id = ?
			OR (p.group_id IS NULL AND p.visibility = 'public')
			OR (p.visibility = 'followers' AND EXISTS (
				SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = p.user_id
			))
			OR (p.visibility = 'custom' AND EXISTS (
				SELECT 1 FROM post_allowed_viewers pav
				JOIN followers f ON f.follower_id = pav.user_id AND f.followed_id = p.user_id
				WHERE pav.post_id = p.id AND pav.user_id = ?
			))
			OR (p.group_id IS NOT NULL AND EXISTS (
				SELECT 1 FROM group_members gm WHERE gm.group_id = p.group_id AND gm.user_id = ?
			))
		)
		AND (
			LOWER(p.title) LIKE LOWER(?) ESCAPE '\'
			OR LOWER(p.content) LIKE LOWER(?) ESCAPE '\'
		)
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT ?
	`, viewerID, viewerID, viewerID, viewerID, likePattern, likePattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]PostResult, 0)
	for rows.Next() {
		var p PostResult
		var rawContent string
		var rawPhoto string
		var rawGroupID sql.NullInt64

		if err := rows.Scan(
			&p.ID,
			&p.Title,
			&rawContent,
			&p.AuthorID,
			&p.AuthorUsername,
			&rawPhoto,
			&rawGroupID,
			&p.GroupTitle,
			&p.CreatedAt,
		); err != nil {
			return nil, err
		}

		p.ContentSnippet = makeSnippet(rawContent, 160)
		p.AuthorPhoto = normalizePhotoURL(rawPhoto)
		if rawGroupID.Valid {
			gid := int(rawGroupID.Int64)
			p.GroupID = &gid
		}

		results = append(results, p)
	}

	return results, rows.Err()
}

func (r *Repository) SearchEvents(viewerID int, query string, limit int) ([]EventResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []EventResult{}, nil
	}
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	likePattern := "%" + escapeLikePattern(query) + "%"

	rows, err := r.db.Query(`
		SELECT
			e.id,
			e.group_id,
			COALESCE(g.title, ''),
			e.title,
			e.description,
			e.event_time,
			e.image_path
		FROM events e
		JOIN groups g ON g.id = e.group_id
		WHERE EXISTS (
			SELECT 1 FROM group_members gm
			WHERE gm.group_id = e.group_id AND gm.user_id = ?
		)
		AND (
			LOWER(e.title) LIKE LOWER(?) ESCAPE '\'
			OR LOWER(e.description) LIKE LOWER(?) ESCAPE '\'
		)
		ORDER BY e.event_time ASC, e.id ASC
		LIMIT ?
	`, viewerID, likePattern, likePattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]EventResult, 0)
	for rows.Next() {
		var e EventResult
		if err := rows.Scan(
			&e.ID,
			&e.GroupID,
			&e.GroupTitle,
			&e.Title,
			&e.Description,
			&e.EventTime,
			&e.ImagePath,
		); err != nil {
			return nil, err
		}
		if e.ImagePath.Valid {
			e.ImageURL = normalizePhotoURL(e.ImagePath.String)
		}
		results = append(results, e)
	}

	return results, rows.Err()
}
