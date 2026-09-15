package likes

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

// CreateLike records userID's like of postID. Liking a post twice is a
// no-op rather than an error - the unique (post_id, user_id) index absorbs
// the duplicate, and l is populated from the existing row so the caller
// always gets back the like that is now in effect.
func (r *Repository) CreateLike(l *like) error {
	l.Created_At = time.Now()

	res, err := r.db.Exec(`
		INSERT OR IGNORE INTO likes (post_id, user_id, created_at)
		VALUES (?, ?, ?)
	`, l.PostID, l.UserID, l.Created_At)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		// Already liked - read back the original row so the response
		// carries the real id and timestamp instead of this attempt's.
		existing, err := r.GetLike(l.PostID, l.UserID)
		if err != nil {
			return err
		}
		*l = *existing
		return nil
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	l.ID = int(id)

	return nil
}

func (r *Repository) GetLike(postID, userID int) (*like, error) {
	var l like

	err := r.db.QueryRow(`
		SELECT id, post_id, user_id, created_at
		FROM likes
		WHERE post_id = ? AND user_id = ?
	`, postID, userID).Scan(&l.ID, &l.PostID, &l.UserID, &l.Created_At)
	if err == sql.ErrNoRows {
		return nil, ErrLikeNotFound
	}
	if err != nil {
		return nil, err
	}

	return &l, nil
}

// CountLikesByPost returns how many users have liked postID.
func (r *Repository) CountLikesByPost(postID int) (int, error) {
	var count int

	err := r.db.QueryRow(`
		SELECT COUNT(*)
		FROM likes
		WHERE post_id = ?
	`, postID).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

// HasLiked reports whether userID has liked postID.
func (r *Repository) HasLiked(postID, userID int) (bool, error) {
	var exists int

	err := r.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?
		)
	`, postID, userID).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists == 1, nil
}

// GetStatus returns postID's like count and whether userID is one of the
// likers, in a single round trip - the pair every like button needs.
func (r *Repository) GetStatus(postID, userID int) (*LikeStatus, error) {
	status := LikeStatus{PostID: postID}

	err := r.db.QueryRow(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END), 0)
		FROM likes
		WHERE post_id = ?
	`, userID, postID).Scan(&status.Count, &status.Liked)
	if err != nil {
		return nil, err
	}

	return &status, nil
}

// DeleteLike removes userID's like of postID, reporting ErrLikeNotFound if
// there was nothing to remove.
func (r *Repository) DeleteLike(postID, userID int) error {
	res, err := r.db.Exec(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`, postID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrLikeNotFound
	}

	return nil
}
