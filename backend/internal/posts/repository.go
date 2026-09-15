package posts

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// CreatePost persists the post, its ordered media, and its custom audience
// atomically. image_path mirrors the first attachment for older clients and
// safe rollback to the pre-media-table schema; post_media is authoritative.
func (r *Repository) CreatePost(post *post, viewerIDs []int) error {
	now := time.Now()
	post.Created_At = now
	post.Updated_At = now
	if len(post.Media) > 0 {
		post.ImagePath = sql.NullString{String: post.Media[0].FilePath, Valid: true}
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO posts (user_id, visibility, title, content, image_path, group_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, post.User_ID, post.visibility, post.Title, post.Content, post.ImagePath, post.GroupID, post.Created_At, post.Updated_At)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	post.ID = int(id)

	for i := range post.Media {
		post.Media[i].PostID = post.ID
		post.Media[i].SortOrder = i
		post.Media[i].CreatedAt = now
		mediaRes, err := tx.Exec(`
			INSERT INTO post_media (post_id, file_path, media_type, sort_order, created_at)
			VALUES (?, ?, ?, ?, ?)
		`, post.ID, post.Media[i].FilePath, post.Media[i].MediaType, i, now)
		if err != nil {
			return err
		}
		mediaID, err := mediaRes.LastInsertId()
		if err != nil {
			return err
		}
		post.Media[i].ID = int(mediaID)
	}

	for _, viewerID := range viewerIDs {
		if _, err := tx.Exec(`
			INSERT INTO post_allowed_viewers (post_id, user_id) VALUES (?, ?)
		`, post.ID, viewerID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *Repository) GetPostByID(id int) (*post, error) {
	var p post

	err := r.db.QueryRow(`
		SELECT id, user_id, visibility, title, content, image_path, group_id, created_at, updated_at
		FROM posts
		WHERE id = ?
	`, id).Scan(&p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.GroupID, &p.Created_At, &p.Updated_At)
	if err == sql.ErrNoRows {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := r.loadMedia([]*post{&p}); err != nil {
		return nil, err
	}
	return &p, nil
}

// authorScopeClause returns the extra SQL condition (ANDed onto the usual
// visibility rules) that narrows ListPosts candidates to a feed's author
// scope, plus the placeholder args it needs. feed must already be
// validated (see ValidateFeedScope) - an unrecognized value is treated the
// same as FeedAll.
func authorScopeClause(feed string, viewerID int) (clause string, args []any) {
	switch feed {
	case FeedFollowing:
		return `AND EXISTS (
			SELECT 1 FROM followers f2
			WHERE f2.follower_id = ? AND f2.followed_id = p.user_id
		)`, []any{viewerID}
	case FeedFriends:
		return `AND EXISTS (
			SELECT 1 FROM followers f2
			WHERE f2.follower_id = ? AND f2.followed_id = p.user_id
		) AND EXISTS (
			SELECT 1 FROM followers f3
			WHERE f3.follower_id = p.user_id AND f3.followed_id = ?
		)`, []any{viewerID, viewerID}
	default:
		return "", nil
	}
}

// ListPosts returns up to limit posts visible to viewerID, newest first,
// restricted to feed's author scope (see authorScopeClause):
//
//   - FeedAll (default): every public post, the viewer's own posts
//     regardless of visibility, followers-only posts from creators the
//     viewer follows, custom-visibility posts where the viewer is both on
//     the allowed-viewer list and still a follower of the creator, and
//     group posts from groups the viewer belongs to.
//   - FeedFollowing: the same visibility rules, but only for posts whose
//     author the viewer follows (which excludes the viewer's own posts).
//   - FeedFriends: the same visibility rules, but only for posts whose
//     author is in a mutual follow with the viewer.
//
// The feed filter only narrows which authors are considered - it never
// grants access to a post the viewer couldn't otherwise see.
func (r *Repository) ListPosts(viewerID, limit int, feed string) ([]*post, error) {
	scopeClause, scopeArgs := authorScopeClause(feed, viewerID)

	args := []any{viewerID, viewerID, viewerID, viewerID}
	args = append(args, scopeArgs...)
	args = append(args, limit)

	rows, err := r.db.Query(`
		SELECT id, user_id, visibility, title, content, image_path, group_id, created_at, updated_at
		FROM posts p
		WHERE (
			p.user_id = ?
			OR (p.group_id IS NULL AND p.visibility = 'public')
			OR (p.visibility = 'followers' AND EXISTS (
				SELECT 1 FROM followers f
				WHERE f.follower_id = ? AND f.followed_id = p.user_id
			))
			OR (p.visibility = 'custom' AND EXISTS (
				SELECT 1 FROM post_allowed_viewers pav
				JOIN followers f ON f.follower_id = pav.user_id AND f.followed_id = p.user_id
				WHERE pav.post_id = p.id AND pav.user_id = ?
			))
			OR (p.group_id IS NOT NULL AND EXISTS (
				SELECT 1 FROM group_members gm
				WHERE gm.group_id = p.group_id AND gm.user_id = ?
			))
		)
		`+scopeClause+`
		ORDER BY p.created_at DESC
		LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []*post{}
	for rows.Next() {
		var p post
		if err := rows.Scan(&p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.GroupID, &p.Created_At, &p.Updated_At); err != nil {
			return nil, err
		}
		posts = append(posts, &p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := r.loadMedia(posts); err != nil {
		return nil, err
	}
	return posts, nil
}

// ListPostsByGroup returns up to limit posts belonging to groupID, newest
// first. The service verifies membership before reaching this data query.
func (r *Repository) ListPostsByGroup(groupID, limit int) ([]*post, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, visibility, title, content, image_path, group_id, created_at, updated_at
		FROM posts
		WHERE group_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, groupID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []*post{}
	for rows.Next() {
		var p post
		if err := rows.Scan(&p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.GroupID, &p.Created_At, &p.Updated_At); err != nil {
			return nil, err
		}
		posts = append(posts, &p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := r.loadMedia(posts); err != nil {
		return nil, err
	}
	return posts, nil
}

// loadMedia fetches attachments for a result set in one query and preserves
// their deterministic sort order without introducing a per-post query.
func (r *Repository) loadMedia(posts []*post) error {
	if len(posts) == 0 {
		return nil
	}

	byID := make(map[int]*post, len(posts))
	placeholders := make([]string, 0, len(posts))
	args := make([]any, 0, len(posts))
	for _, p := range posts {
		p.Media = []postMedia{}
		byID[p.ID] = p
		placeholders = append(placeholders, "?")
		args = append(args, p.ID)
	}

	rows, err := r.db.Query(fmt.Sprintf(`
		SELECT id, post_id, file_path, media_type, sort_order, created_at
		FROM post_media
		WHERE post_id IN (%s)
		ORDER BY post_id, sort_order, id
	`, strings.Join(placeholders, ",")), args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var media postMedia
		if err := rows.Scan(&media.ID, &media.PostID, &media.FilePath, &media.MediaType, &media.SortOrder, &media.CreatedAt); err != nil {
			return err
		}
		if p := byID[media.PostID]; p != nil {
			p.Media = append(p.Media, media)
		}
	}
	return rows.Err()
}

func (r *Repository) UpdatePost(post *post) error {
	post.Updated_At = time.Now()

	res, err := r.db.Exec(`
		UPDATE posts
		SET visibility = ?, title = ?, content = ?, updated_at = ?
		WHERE id = ?
	`, post.visibility, post.Title, post.Content, post.Updated_At, post.ID)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrPostNotFound
	}

	return nil
}

func (r *Repository) DeletePost(id int) error {
	res, err := r.db.Exec(`DELETE FROM posts WHERE id = ?`, id)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrPostNotFound
	}

	return nil
}

// IsAllowedViewer reports whether userID is on postID's custom-visibility
// allowed-viewer list.
func (r *Repository) IsAllowedViewer(postID, userID int) (bool, error) {
	var exists int

	err := r.db.QueryRow(`
		SELECT 1 FROM post_allowed_viewers
		WHERE post_id = ? AND user_id = ?
		LIMIT 1
	`, postID, userID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

// GetAllowedViewerIDs returns the user IDs on postID's custom-visibility
// allowed-viewer list.
func (r *Repository) GetAllowedViewerIDs(postID int) ([]int, error) {
	rows, err := r.db.Query(`
		SELECT user_id FROM post_allowed_viewers WHERE post_id = ?
	`, postID)
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

// SetAllowedViewerIDs replaces postID's custom-visibility allowed-viewer
// list with viewerIDs.
func (r *Repository) SetAllowedViewerIDs(postID int, viewerIDs []int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM post_allowed_viewers WHERE post_id = ?`, postID); err != nil {
		return err
	}

	for _, viewerID := range viewerIDs {
		if _, err := tx.Exec(`
			INSERT INTO post_allowed_viewers (post_id, user_id)
			VALUES (?, ?)
		`, postID, viewerID); err != nil {
			return err
		}
	}

	return tx.Commit()
}
