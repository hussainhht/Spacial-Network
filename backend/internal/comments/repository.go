package comments

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

func (r *Repository) CreateComment(c *comment) error {
	now := time.Now()
	c.Created_At = now
	c.Updated_At = now

	res, err := r.db.Exec(`
		INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, c.PostID, c.UserID, c.Content, c.Created_At, c.Updated_At)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	c.ID = int(id)

	return nil
}

func (r *Repository) GetCommentByID(id int) (*comment, error) {
	var c comment

	err := r.db.QueryRow(`
		SELECT id, post_id, user_id, content, created_at, updated_at
		FROM comments
		WHERE id = ?
	`, id).Scan(&c.ID, &c.PostID, &c.UserID, &c.Content, &c.Created_At, &c.Updated_At)
	if err == sql.ErrNoRows {
		return nil, ErrCommentNotFound
	}
	if err != nil {
		return nil, err
	}

	return &c, nil
}

// ListCommentsByPost returns every comment on postID, oldest first.
func (r *Repository) ListCommentsByPost(postID int) ([]*comment, error) {
	rows, err := r.db.Query(`
		SELECT id, post_id, user_id, content, created_at, updated_at
		FROM comments
		WHERE post_id = ?
		ORDER BY created_at ASC
	`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []*comment{}
	for rows.Next() {
		var c comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Content, &c.Created_At, &c.Updated_At); err != nil {
			return nil, err
		}
		comments = append(comments, &c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return comments, nil
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
