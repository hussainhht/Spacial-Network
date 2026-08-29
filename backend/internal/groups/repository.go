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

// InsertGroup creates a new group, adds the creator as a group member, and
// returns the new group's ID. Both writes happen in a single transaction so
// a group is never left without its creator as a member.
func (r *Repository) InsertGroup(creatorID int, title, description string) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO groups (creator_id, title, description) VALUES (?, ?, ?)`,
		creatorID,
		title,
		description,
	)
	if err != nil {
		return 0, err
	}

	groupID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	if _, err := tx.Exec(
		`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'creator')`,
		groupID,
		creatorID,
	); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return groupID, nil
}

// GetAllGroups returns a page of groups, most recently created first.
func (r *Repository) GetAllGroups(limit, offset int) ([]Group, error) {
	rows, err := r.db.Query(
		`SELECT id, creator_id, title, description, created_at, updated_at
		 FROM groups
		 ORDER BY created_at DESC
		 LIMIT ? OFFSET ?`,
		limit,
		offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Group, 0)
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, g)
	}

	return result, rows.Err()
}

// GetGroupByID returns the group with the given ID, or ErrGroupNotFound if
// it doesn't exist.
func (r *Repository) GetGroupByID(id int) (*Group, error) {
	var g Group

	err := r.db.QueryRow(
		`SELECT id, creator_id, title, description, created_at, updated_at
		 FROM groups
		 WHERE id = ?`,
		id,
	).Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrGroupNotFound
		}
		return nil, err
	}

	return &g, nil
}
