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
		INSERT INTO posts (user_id, private, title, content, image_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, post.User_ID, post.isPrivate, post.Title, post.Content, post.ImagePath, post.Created_At, post.Updated_At)
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
		SELECT id, user_id, private, title, content, image_path, created_at, updated_at
		FROM posts
		WHERE id = ?
	`, id).Scan(&p.ID, &p.User_ID, &p.isPrivate, &p.Title, &p.Content, &p.ImagePath, &p.Created_At, &p.Updated_At)
	if err == sql.ErrNoRows {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, err
	}

	return &p, nil
}

// ListPosts returns all posts visible to viewerID: every public post plus
// the viewer's own private posts, newest first.
func (r *Repository) ListPosts(viewerID int) ([]*post, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, private, title, content, image_path, created_at, updated_at
		FROM posts
		WHERE private = 0 OR user_id = ?
		ORDER BY created_at DESC
	`, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []*post{}
	for rows.Next() {
		var p post
		if err := rows.Scan(&p.ID, &p.User_ID, &p.isPrivate, &p.Title, &p.Content, &p.ImagePath, &p.Created_At, &p.Updated_At); err != nil {
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
		SET private = ?, title = ?, content = ?, updated_at = ?
		WHERE id = ?
	`, post.isPrivate, post.Title, post.Content, post.Updated_At, post.ID)
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
