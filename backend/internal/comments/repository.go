package comments

import (
	"database/sql"
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

func (r *Repository) CreateComment(c *comment) error {
	now := time.Now()
	c.Created_At = now
	c.Updated_At = now

	res, err := r.db.Exec(`
		INSERT INTO comments (post_id, user_id, content, image_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, c.PostID, c.UserID, c.Content, c.ImagePath, c.Created_At, c.Updated_At)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	c.ID = int(id)

	return r.loadCommentAuthor(c)
}

func (r *Repository) loadCommentAuthor(c *comment) error {
	var profilePhoto string
	err := r.db.QueryRow(`
		SELECT id, username, first_name, last_name, COALESCE(profile_photo, '')
		FROM users
		WHERE id = ?
	`, c.UserID).Scan(
		&c.Author.ID,
		&c.Author.Username,
		&c.Author.FirstName,
		&c.Author.LastName,
		&profilePhoto,
	)
	if err != nil {
		return err
	}
	if profilePhoto != "" {
		c.Author.ProfilePhoto = "/uploads/" + strings.TrimPrefix(profilePhoto, "/")
	}
	return nil
}

func (r *Repository) GetCommentByID(id int) (*comment, error) {
	var c comment

	var profilePhoto string
	err := r.db.QueryRow(`
		SELECT c.id, c.post_id, c.user_id, c.content, c.image_path,
		       c.created_at, c.updated_at,
		       u.id, u.username, u.first_name, u.last_name,
		       COALESCE(u.profile_photo, '')
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.id = ?
	`, id).Scan(
		&c.ID, &c.PostID, &c.UserID, &c.Content, &c.ImagePath,
		&c.Created_At, &c.Updated_At,
		&c.Author.ID, &c.Author.Username, &c.Author.FirstName,
		&c.Author.LastName, &profilePhoto,
	)
	if err == sql.ErrNoRows {
		return nil, ErrCommentNotFound
	}
	if err != nil {
		return nil, err
	}
	if profilePhoto != "" {
		c.Author.ProfilePhoto = "/uploads/" + strings.TrimPrefix(profilePhoto, "/")
	}

	return &c, nil
}

// ListCommentsByPost returns every comment on postID, oldest first.
func (r *Repository) ListCommentsByPost(postID int) ([]*comment, error) {
	rows, err := r.db.Query(`
		SELECT c.id, c.post_id, c.user_id, c.content, c.image_path,
		       c.created_at, c.updated_at,
		       u.id, u.username, u.first_name, u.last_name,
		       COALESCE(u.profile_photo, '')
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC
	`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []*comment{}
	for rows.Next() {
		var c comment
		var profilePhoto string
		if err := rows.Scan(
			&c.ID, &c.PostID, &c.UserID, &c.Content, &c.ImagePath,
			&c.Created_At, &c.Updated_At,
			&c.Author.ID, &c.Author.Username, &c.Author.FirstName,
			&c.Author.LastName, &profilePhoto,
		); err != nil {
			return nil, err
		}
		if profilePhoto != "" {
			c.Author.ProfilePhoto = "/uploads/" + strings.TrimPrefix(profilePhoto, "/")
		}
		comments = append(comments, &c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return comments, nil
}

// CountByPost returns how many comments exist on postID.
func (r *Repository) CountByPost(postID int) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM comments WHERE post_id = ?`, postID).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (r *Repository) DeleteComment(id int) error {
	res, err := r.db.Exec(`DELETE FROM comments WHERE id = ?`, id)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrCommentNotFound
	}

	return nil
}
