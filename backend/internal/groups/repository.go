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

// GetMembership returns userID's membership row in groupID, or nil (with no
// error) if they are not a member.
func (r *Repository) GetMembership(groupID, userID int) (*GroupMember, error) {
	var m GroupMember

	err := r.db.QueryRow(
		`SELECT gm.user_id, u.username, gm.role, gm.joined_at
		 FROM group_members gm
		 JOIN users u ON u.id = gm.user_id
		 WHERE gm.group_id = ? AND gm.user_id = ?`,
		groupID,
		userID,
	).Scan(&m.UserID, &m.Username, &m.Role, &m.JoinedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &m, nil
}

// AddMember adds userID to groupID as a regular member. Returns
// ErrAlreadyMember if userID is already a member of groupID.
func (r *Repository) AddMember(groupID, userID int) error {
	member, err := r.GetMembership(groupID, userID)
	if err != nil {
		return err
	}
	if member != nil {
		return ErrAlreadyMember
	}

	_, err = r.db.Exec(
		`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')`,
		groupID,
		userID,
	)
	return err
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

// GetGroupMembers returns the members of a group, earliest joined first.
func (r *Repository) GetGroupMembers(groupID int) ([]GroupMember, error) {
	rows, err := r.db.Query(
		`SELECT gm.user_id, u.username, gm.role, gm.joined_at
		 FROM group_members gm
		 JOIN users u ON u.id = gm.user_id
		 WHERE gm.group_id = ?
		 ORDER BY gm.joined_at ASC`,
		groupID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]GroupMember, 0)
	for rows.Next() {
		var m GroupMember
		if err := rows.Scan(&m.UserID, &m.Username, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		result = append(result, m)
	}

	return result, rows.Err()
}
