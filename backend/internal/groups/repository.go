package groups

import (
	"database/sql"
	"errors"
	"github.com/mattn/go-sqlite3"
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

func (r *Repository) InsertGroup(creatorID int, title, description, photoPath string) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO groups (creator_id, title, description, group_photo) VALUES (?, ?, ?, NULLIF(?, ''))`,
		creatorID,
		title,
		description,
		photoPath,
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

func (r *Repository) GetAllGroups(limit, offset, userID int, search string) ([]Group, error) {
	like := "%" + escapeLikePattern(search) + "%"
	rows, err := r.db.Query(
		`SELECT g.id, g.creator_id, g.title, g.description, COALESCE(g.group_photo, ''), g.created_at, g.updated_at,
         u.username, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id),
         COALESCE((SELECT role FROM group_members WHERE group_id = g.id AND user_id = ?), ''),
         EXISTS(SELECT 1 FROM group_join_requests WHERE group_id = g.id AND user_id = ? AND status = 'pending'),
         EXISTS(SELECT 1 FROM group_invitations WHERE group_id = g.id AND invited_user_id = ? AND status = 'pending')
         FROM groups g JOIN users u ON u.id = g.creator_id
         WHERE (? = '' OR LOWER(g.title) LIKE LOWER(?) ESCAPE '\' OR LOWER(g.description) LIKE LOWER(?) ESCAPE '\')
         ORDER BY g.created_at DESC, g.id DESC
		 LIMIT ? OFFSET ?`,
		userID, userID, userID,
		search, like, like,
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
		if err := rows.Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.GroupPhoto, &g.CreatedAt, &g.UpdatedAt, &g.CreatorUsername, &g.MemberCount, &g.MembershipRole, &g.HasPendingJoinRequest, &g.HasPendingInvitation); err != nil {
			return nil, err
		}
		result = append(result, g)
	}

	return result, rows.Err()
}

// GetGroupsForUser returns groups the given user actually belongs to
// (creator or member), most recently created first. Membership is
// determined strictly from group_members - pending invitations and join
// requests never appear here.
func (r *Repository) GetGroupsForUser(userID, limit, offset int, search string) ([]Group, error) {
	like := "%" + escapeLikePattern(search) + "%"
	rows, err := r.db.Query(
		`SELECT g.id, g.creator_id, g.title, g.description, COALESCE(g.group_photo, ''), g.created_at, g.updated_at,
         u.username, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id), gm.role
         FROM groups g
         JOIN users u ON u.id = g.creator_id
         JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
         WHERE (? = '' OR LOWER(g.title) LIKE LOWER(?) ESCAPE '\' OR LOWER(g.description) LIKE LOWER(?) ESCAPE '\')
         ORDER BY g.created_at DESC, g.id DESC
         LIMIT ? OFFSET ?`,
		userID,
		search, like, like,
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
		if err := rows.Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.GroupPhoto, &g.CreatedAt, &g.UpdatedAt, &g.CreatorUsername, &g.MemberCount, &g.MembershipRole); err != nil {
			return nil, err
		}
		result = append(result, g)
	}

	return result, rows.Err()
}

func (r *Repository) GetMembership(groupID, userID int) (*GroupMember, error) {
	var m GroupMember

	err := r.db.QueryRow(
		`SELECT gm.user_id, u.username, gm.role, gm.joined_at, COALESCE(u.profile_photo, '')
		 FROM group_members gm
		 JOIN users u ON u.id = gm.user_id
		 WHERE gm.group_id = ? AND gm.user_id = ?`,
		groupID,
		userID,
	).Scan(&m.UserID, &m.Username, &m.Role, &m.JoinedAt, &m.Avatar)
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

// RemoveMember deletes a single group_members row, leaving every other
// membership, the group, and the user untouched. Business rules (creator
// permission, protecting the creator's own membership) live in the service
// layer - this is a plain, scoped delete.
func (r *Repository) RemoveMember(groupID, memberID int) error {
	result, err := r.db.Exec(
		`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
		groupID,
		memberID,
	)
	if err != nil {
		return err
	}

	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrMemberNotFound
	}

	return nil
}

func (r *Repository) GetGroupByID(id int) (*Group, error) {
	var g Group

	err := r.db.QueryRow(
		`SELECT g.id, g.creator_id, g.title, g.description, COALESCE(g.group_photo, ''), g.created_at, g.updated_at,
         u.username, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)
         FROM groups g JOIN users u ON u.id = g.creator_id WHERE g.id = ?`,
		id,
	).Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.GroupPhoto, &g.CreatedAt, &g.UpdatedAt, &g.CreatorUsername, &g.MemberCount)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrGroupNotFound
		}
		return nil, err
	}

	return &g, nil
}

// UpdateGroup updates a group's title and description. A nil photoPath
// leaves the existing photo untouched; a non-nil pointer replaces it (an
// empty string clears it, matching the "remove photo" behavior).
func (r *Repository) UpdateGroup(groupID int, title, description string, photoPath *string) error {
	if photoPath == nil {
		_, err := r.db.Exec(
			`UPDATE groups SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			title,
			description,
			groupID,
		)
		return err
	}

	_, err := r.db.Exec(
		`UPDATE groups SET title = ?, description = ?, group_photo = NULLIF(?, ''), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		title,
		description,
		*photoPath,
		groupID,
	)
	return err
}

// DeleteGroup deletes a group by ID. Related rows (members, invitations,
// join requests, events, event responses, ...) are removed by the
// database's ON DELETE CASCADE foreign keys - see the groups migrations.
func (r *Repository) DeleteGroup(groupID int) error {
	result, err := r.db.Exec(`DELETE FROM groups WHERE id = ?`, groupID)
	if err != nil {
		return err
	}

	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrGroupNotFound
	}

	return nil
}

func (r *Repository) GetGroupMembers(groupID int) ([]GroupMember, error) {
	rows, err := r.db.Query(
		`SELECT gm.user_id, u.username, gm.role, gm.joined_at, COALESCE(u.profile_photo, '')
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
		if err := rows.Scan(&m.UserID, &m.Username, &m.Role, &m.JoinedAt, &m.Avatar); err != nil {
			return nil, err
		}
		result = append(result, m)
	}

	return result, rows.Err()
}

func (r *Repository) CreateGroupInvitation(groupID, invitedBy, invitedUserID int) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO group_invitations (group_id, invited_by, invited_user_id)
         SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?)`,
		groupID,
		invitedBy,
		invitedUserID, groupID, invitedUserID,
	)
	if err != nil {
		return 0, pendingInsertError(err, ErrInvitationAlreadyPending)
	}
	if n, err := result.RowsAffected(); err != nil {
		return 0, err
	} else if n == 0 {
		return 0, ErrAlreadyMember
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
		`SELECT i.id, i.group_id, i.invited_by, i.invited_user_id, i.status, i.created_at, i.updated_at, g.title, u.username
         FROM group_invitations i JOIN groups g ON g.id = i.group_id JOIN users u ON u.id = i.invited_by
         WHERE i.invited_user_id = ? AND i.status = 'pending'
         ORDER BY i.created_at DESC, i.id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]GroupInvitation, 0)
	for rows.Next() {
		var inv GroupInvitation
		if err := rows.Scan(&inv.ID, &inv.GroupID, &inv.InvitedBy, &inv.InvitedUserID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt, &inv.GroupTitle, &inv.InviterUsername); err != nil {
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

func (r *Repository) CreateGroupJoinRequest(groupID, userID int) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO group_join_requests (group_id, user_id)
         SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?)`,
		groupID,
		userID, groupID, userID,
	)
	if err != nil {
		return 0, pendingInsertError(err, ErrJoinRequestAlreadyPending)
	}

	if n, err := result.RowsAffected(); err != nil {
		return 0, err
	} else if n == 0 {
		return 0, ErrAlreadyMember
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
		`SELECT jr.id, jr.group_id, jr.user_id, jr.status, jr.created_at, jr.updated_at, u.username
         FROM group_join_requests jr JOIN users u ON u.id = jr.user_id
         WHERE jr.group_id = ? AND jr.status = 'pending'
         ORDER BY jr.created_at DESC, jr.id DESC`,
		groupID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]GroupJoinRequest, 0)
	for rows.Next() {
		var jr GroupJoinRequest
		if err := rows.Scan(&jr.ID, &jr.GroupID, &jr.UserID, &jr.Status, &jr.CreatedAt, &jr.UpdatedAt, &jr.Username); err != nil {
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

func pendingInsertError(err error, conflict error) error {
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
		return conflict
	}
	return err
}

func (r *Repository) UserExists(userID int) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)`, userID).Scan(&exists)
	return exists, err
}
