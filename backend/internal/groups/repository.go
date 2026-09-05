package groups

import (
	"database/sql"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db: db,
	}
}

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

func (r *Repository) CreateGroupInvitation(groupID, invitedBy, invitedUserID int) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO group_invitations (group_id, invited_by, invited_user_id) VALUES (?, ?, ?)`,
		groupID,
		invitedBy,
		invitedUserID,
	)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (r *Repository) GetGroupInvitationByID(invitationID int) (*GroupInvitation, error) {
	var inv GroupInvitation

	err := r.db.QueryRow(
		`SELECT id, group_id, invited_by, invited_user_id, status, created_at, updated_at
		 FROM group_invitations
		 WHERE id = ?`,
		invitationID,
	).Scan(&inv.ID, &inv.GroupID, &inv.InvitedBy, &inv.InvitedUserID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}

	return &inv, nil
}

func (r *Repository) GetPendingInvitationsByUser(userID int) ([]GroupInvitation, error) {
	rows, err := r.db.Query(
		`SELECT id, group_id, invited_by, invited_user_id, status, created_at, updated_at
		 FROM group_invitations
		 WHERE invited_user_id = ? AND status = 'pending'
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]GroupInvitation, 0)
	for rows.Next() {
		var inv GroupInvitation
		if err := rows.Scan(&inv.ID, &inv.GroupID, &inv.InvitedBy, &inv.InvitedUserID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, inv)
	}

	return result, rows.Err()
}

func (r *Repository) HasPendingInvitation(groupID, invitedUserID int) (bool, error) {
	var one int

	err := r.db.QueryRow(
		`SELECT 1 FROM group_invitations
		 WHERE group_id = ? AND invited_user_id = ? AND status = 'pending'`,
		groupID,
		invitedUserID,
	).Scan(&one)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (r *Repository) UpdateInvitationStatus(invitationID int, status string) error {
	result, err := r.db.Exec(
		`UPDATE group_invitations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		status,
		invitationID,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrInvitationNotFound
	}

	return nil
}

func (r *Repository) CreateGroupJoinRequest(groupID, userID int) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO group_join_requests (group_id, user_id) VALUES (?, ?)`,
		groupID,
		userID,
	)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (r *Repository) GetGroupJoinRequestByID(requestID int) (*GroupJoinRequest, error) {
	var jr GroupJoinRequest

	err := r.db.QueryRow(
		`SELECT id, group_id, user_id, status, created_at, updated_at
		 FROM group_join_requests
		 WHERE id = ?`,
		requestID,
	).Scan(&jr.ID, &jr.GroupID, &jr.UserID, &jr.Status, &jr.CreatedAt, &jr.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrJoinRequestNotFound
		}
		return nil, err
	}

	return &jr, nil
}

func (r *Repository) GetPendingJoinRequestsByGroup(groupID int) ([]GroupJoinRequest, error) {
	rows, err := r.db.Query(
		`SELECT id, group_id, user_id, status, created_at, updated_at
		 FROM group_join_requests
		 WHERE group_id = ? AND status = 'pending'
		 ORDER BY created_at DESC`,
		groupID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]GroupJoinRequest, 0)
	for rows.Next() {
		var jr GroupJoinRequest
		if err := rows.Scan(&jr.ID, &jr.GroupID, &jr.UserID, &jr.Status, &jr.CreatedAt, &jr.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, jr)
	}

	return result, rows.Err()
}

func (r *Repository) HasPendingJoinRequest(groupID, userID int) (bool, error) {
	var one int

	err := r.db.QueryRow(
		`SELECT 1 FROM group_join_requests
		 WHERE group_id = ? AND user_id = ? AND status = 'pending'`,
		groupID,
		userID,
	).Scan(&one)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}


func (r *Repository) SearchInviteCandidates(groupID, currentUserID int, query string, limit int) ([]InviteCandidate, error) {
	like := "%" + escapeLikePattern(query) + "%"

	rows, err := r.db.Query(
		`SELECT u.id, u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		 FROM users u
		 WHERE u.id != ?
		   AND (
		     LOWER(u.username) LIKE LOWER(?) ESCAPE '\'
		     OR LOWER(u.first_name) LIKE LOWER(?) ESCAPE '\'
		     OR LOWER(u.last_name) LIKE LOWER(?) ESCAPE '\'
		     OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER(?) ESCAPE '\'
		   )
		   AND NOT EXISTS (
		     SELECT 1 FROM group_members gm
		     WHERE gm.group_id = ? AND gm.user_id = u.id
		   )
		   AND NOT EXISTS (
		     SELECT 1 FROM group_invitations gi
		     WHERE gi.group_id = ? AND gi.invited_user_id = u.id AND gi.status = 'pending'
		   )
		 ORDER BY u.username ASC
		 LIMIT ?`,
		currentUserID,
		like, like, like, like,
		groupID,
		groupID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]InviteCandidate, 0)
	for rows.Next() {
		var c InviteCandidate
		if err := rows.Scan(&c.ID, &c.Username, &c.FirstName, &c.LastName, &c.ProfilePhoto); err != nil {
			return nil, err
		}
		result = append(result, c)
	}

	return result, rows.Err()
}


func escapeLikePattern(s string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`) 
	return replacer.Replace(s)
}

func (r *Repository) UpdateJoinRequestStatus(requestID int, status string) error {
	result, err := r.db.Exec(
		`UPDATE group_join_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		status,
		requestID,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrJoinRequestNotFound
	}

	return nil
}
