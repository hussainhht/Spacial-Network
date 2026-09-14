package groups

import "database/sql"

func (r *Repository) RespondToJoinRequest(groupID, requestID, creatorID int, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Verify group exists and verify that creatorID is indeed the group creator.
	var (
		ownerID int
		privacy GroupPrivacy
	)
	err = tx.QueryRow(
		`SELECT creator_id, privacy FROM groups WHERE id = ?`,
		groupID,
	).Scan(&ownerID, &privacy)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrGroupNotFound
		}
		return err
	}
	if ownerID != creatorID {
		return ErrNotGroupCreator
	}
	if privacy != GroupPrivacyPublic {
		return ErrJoinRequestNotAllowed
	}

	// 2. Fetch the join request and verify it is currently pending.
	var (
		userID        int
		currentStatus string
	)
	err = tx.QueryRow(
		`SELECT user_id, status FROM group_join_requests WHERE id = ? AND group_id = ?`,
		requestID,
		groupID,
	).Scan(&userID, &currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrJoinRequestNotFound
		}
		return err
	}
	if currentStatus != StatusPending {
		return ErrJoinRequestNotPending
	}

	// 3. Atomically update the join request status.
	// Matching `status = 'pending'` ensures no concurrent state transition occurred.
	result, err := tx.Exec(
		`UPDATE group_join_requests
		 SET status = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND group_id = ? AND status = 'pending'`,
		status,
		requestID,
		groupID,
	)
	if err := transitionResult(result, err, ErrJoinRequestNotPending); err != nil {
		return err
	}

	// 4. If accepted, establish group membership and mark any pending invitations/requests as accepted.
	if status == StatusAccepted {
		if err := establishMembership(tx, groupID, userID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// RespondToInvitation processes an invited user's response (e.g., accepted or declined)
// to a pending group invitation.
func (r *Repository) RespondToInvitation(invitationID, userID int, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Fetch the invitation and verify it exists for this user and is currently pending.
	var (
		groupID       int
		currentStatus string
	)
	err = tx.QueryRow(
		`SELECT group_id, status FROM group_invitations WHERE id = ? AND invited_user_id = ?`,
		invitationID,
		userID,
	).Scan(&groupID, &currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrInvitationNotFound
		}
		return err
	}
	if currentStatus != StatusPending {
		return ErrInvitationNotPending
	}

	// 2. Atomically update the invitation status.
	// Matching `status = 'pending'` ensures no concurrent state transition occurred.
	result, err := tx.Exec(
		`UPDATE group_invitations
		 SET status = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND invited_user_id = ? AND status = 'pending'`,
		status,
		invitationID,
		userID,
	)
	if err := transitionResult(result, err, ErrInvitationNotPending); err != nil {
		return err
	}

	// 3. If accepted, establish group membership and mark any pending invitations/requests as accepted.
	if status == StatusAccepted {
		if err := establishMembership(tx, groupID, userID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// transitionResult checks the result of a state update. It verifies that the update
// executed without error and affected exactly one row. If 0 rows were updated
// (e.g., due to a race condition), it returns the provided conflict error.
func transitionResult(result sql.Result, err error, conflict error) error {
	if err != nil {
		return err
	}

	n, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if n != 1 {
		return conflict
	}

	return nil
}

// establishMembership adds the user to the group and resolves any overlapping
// pending requests or invitations.
func establishMembership(tx *sql.Tx, groupID, userID int) error {
	// 1. Insert membership record (idempotent: does nothing if already a member).
	_, err := tx.Exec(
		`INSERT INTO group_members (group_id, user_id, role)
		 VALUES (?, ?, 'member')
		 ON CONFLICT(group_id, user_id) DO NOTHING`,
		groupID,
		userID,
	)
	if err != nil {
		return err
	}

	// 2. Acceptance satisfies both attempts (join requests and invitations).
	// Retain their IDs and audit history, but neither can remain actionable (pending)
	// after membership has been established.
	_, err = tx.Exec(
		`UPDATE group_join_requests
		 SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
		 WHERE group_id = ? AND user_id = ? AND status = 'pending'`,
		groupID,
		userID,
	)
	if err != nil {
		return err
	}

	_, err = tx.Exec(
		`UPDATE group_invitations
		 SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
		 WHERE group_id = ? AND invited_user_id = ? AND status = 'pending'`,
		groupID,
		userID,
	)
	return err
}
