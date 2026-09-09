package posts

import (
	"database/sql"
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

func (r *Repository) CreatePost(post *post) error {
	now := time.Now()
	post.Created_At = now
	post.Updated_At = now

	res, err := r.db.Exec(`
		INSERT INTO posts (user_id, visibility, title, content, image_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, post.User_ID, post.visibility, post.Title, post.Content, post.ImagePath, post.Created_At, post.Updated_At)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	post.ID = int(id)

	return nil
}

func (r *Repository) GetPostByID(id int) (*post, error) {
	var p post

	err := r.db.QueryRow(`
		SELECT id, user_id, visibility, title, content, image_path, created_at, updated_at
		FROM posts
		WHERE id = ?
	`, id).Scan(&p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.Created_At, &p.Updated_At)
	if err == sql.ErrNoRows {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, err
	}

	return &p, nil
}

// ListPosts returns up to limit posts visible to viewerID, newest first:
// every public post, the viewer's own posts regardless of visibility,
// followers-only posts from creators the viewer follows, and custom-visibility
// posts where the viewer is both on the allowed-viewer list and still a
// follower of the creator.
func (r *Repository) ListPosts(viewerID, limit int) ([]*post, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, visibility, title, content, image_path, created_at, updated_at
		FROM posts p
		WHERE p.user_id = ?
			OR p.visibility = 'public'
			OR (p.visibility = 'followers' AND EXISTS (
				SELECT 1 FROM followers f
				WHERE f.follower_id = ? AND f.followed_id = p.user_id
			))
			OR (p.visibility = 'custom' AND EXISTS (
				SELECT 1 FROM post_allowed_viewers pav
				JOIN followers f ON f.follower_id = pav.user_id AND f.followed_id = p.user_id
				WHERE pav.post_id = p.id AND pav.user_id = ?
			))
		ORDER BY p.created_at DESC
		LIMIT ?
	`, viewerID, viewerID, viewerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []*post{}
	for rows.Next() {
		var p post
		if err := rows.Scan(&p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.Created_At, &p.Updated_At); err != nil {
			return nil, err
		}
		posts = append(posts, &p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return posts, nil
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
