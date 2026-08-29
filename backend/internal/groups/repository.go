package groups

import (
	"database/sql"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// InsertGroup creates a new group and returns its generated ID.
func (r *Repository) InsertGroup(creatorID int, title, description string) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO groups (creator_id, title, description) VALUES (?, ?, ?)`,
		creatorID,
		title,
		description,
	)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}
