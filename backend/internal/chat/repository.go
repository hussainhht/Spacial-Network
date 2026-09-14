package chat

import (
	"database/sql"
	"fmt"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) SavePrivateMessage(senderID, recipientID int64, content string) (*PrivateMessage, error) {
	query := `
		INSERT INTO private_messages (sender_id, recipient_id, content)
		VALUES (?, ?, ?)
		RETURNING id, sender_id, recipient_id, content, created_at, read_at
	`

	var msg PrivateMessage
	err := r.db.QueryRow(query, senderID, recipientID, content).Scan(
		&msg.ID,
		&msg.SenderID,
		&msg.RecipientID,
		&msg.Content,
		&msg.CreatedAt,
		&msg.ReadAt,
	)
	if err != nil {
		return nil, fmt.Errorf("save private message: %w", err)
	}

	return &msg, nil
}

func (r *Repository) GetPrivateHistory(userA, userB int64, limit, offset int) ([]PrivateMessage, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT id, sender_id, recipient_id, content, created_at, read_at
		FROM private_messages
		WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
		ORDER BY created_at DESC, id DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.Query(query, userA, userB, userB, userA, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query private history: %w", err)
	}
	defer rows.Close()

	var messages []PrivateMessage
	for rows.Next() {
		var m PrivateMessage
		if err := rows.Scan(
			&m.ID,
			&m.SenderID,
			&m.RecipientID,
			&m.Content,
			&m.CreatedAt,
			&m.ReadAt,
		); err != nil {
			return nil, fmt.Errorf("scan private message: %w", err)
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate private messages: %w", err)
	}

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

func (r *Repository) GetRecentConversations(userID int64) ([]ConversationSummary, error) {
	query := `
		WITH RankedMessages AS (
			SELECT 
				CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partner_id,
				content AS last_message,
				created_at AS last_message_at,
				ROW_NUMBER() OVER (
					PARTITION BY CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
					ORDER BY created_at DESC, id DESC
				) as rn
			FROM private_messages
			WHERE sender_id = ? OR recipient_id = ?
		)
		SELECT 
			rm.partner_id,
			u.username,
			u.first_name,
			u.last_name,
			COALESCE(u.profile_photo, ''),
			rm.last_message,
			rm.last_message_at,
			(
				SELECT COUNT(*) 
				FROM private_messages 
				WHERE sender_id = rm.partner_id AND recipient_id = ? AND read_at IS NULL
			) AS unread_count
		FROM RankedMessages rm
		JOIN users u ON u.id = rm.partner_id
		WHERE rm.rn = 1
		ORDER BY rm.last_message_at DESC
	`

	rows, err := r.db.Query(query, userID, userID, userID, userID, userID)
	if err != nil {
		return nil, fmt.Errorf("query recent conversations: %w", err)
	}
	defer rows.Close()

	var conversations []ConversationSummary
	for rows.Next() {
		var c ConversationSummary
		var rawTime time.Time
		if err := rows.Scan(
			&c.PartnerID,
			&c.PartnerUsername,
			&c.PartnerFirstName,
			&c.PartnerLastName,
			&c.PartnerAvatar,
			&c.LastMessage,
			&rawTime,
			&c.UnreadCount,
		); err != nil {
			return nil, fmt.Errorf("scan conversation summary: %w", err)
		}
		c.LastMessageAt = rawTime.UTC().Format(time.RFC3339)
		conversations = append(conversations, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate conversation summaries: %w", err)
	}

	return conversations, nil
}

func (r *Repository) MarkMessagesAsRead(senderID, recipientID int64) error {
	query := `
		UPDATE private_messages
		SET read_at = CURRENT_TIMESTAMP
		WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL
	`
	_, err := r.db.Exec(query, senderID, recipientID)
	if err != nil {
		return fmt.Errorf("mark messages as read: %w", err)
	}
	return nil
}

func (r *Repository) UserExists(userID int64) (bool, error) {
	var exists int
	err := r.db.QueryRow(`SELECT 1 FROM users WHERE id = ? LIMIT 1`, userID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check user exists: %w", err)
	}
	return true, nil
}

func (r *Repository) SaveGroupMessage(groupID, userID int64, content string) (*GroupMessage, error) {
	query := `
		INSERT INTO group_messages (group_id, user_id, content)
		VALUES (?, ?, ?)
		RETURNING id, group_id, user_id, content, created_at
	`

	var msg GroupMessage
	err := r.db.QueryRow(query, groupID, userID, content).Scan(
		&msg.ID,
		&msg.GroupID,
		&msg.UserID,
		&msg.Content,
		&msg.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("save group message: %w", err)
	}

	var profilePhoto sql.NullString
	userQuery := `
		SELECT username, first_name, last_name, profile_photo
		FROM users
		WHERE id = ?
	`
	err = r.db.QueryRow(userQuery, userID).Scan(
		&msg.Username,
		&msg.FirstName,
		&msg.LastName,
		&profilePhoto,
	)
	if err == nil && profilePhoto.Valid && profilePhoto.String != "" {
		msg.Avatar = "/uploads/" + profilePhoto.String
	}

	return &msg, nil
}

func (r *Repository) GetGroupHistory(groupID int64, limit, offset int) ([]GroupMessage, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT gm.id, gm.group_id, gm.user_id, gm.content, gm.created_at,
		       u.username, u.first_name, u.last_name, COALESCE(u.profile_photo, '')
		FROM group_messages gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY gm.created_at DESC, gm.id DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.Query(query, groupID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query group history: %w", err)
	}
	defer rows.Close()

	var messages []GroupMessage
	for rows.Next() {
		var m GroupMessage
		var photo string
		if err := rows.Scan(
			&m.ID,
			&m.GroupID,
			&m.UserID,
			&m.Content,
			&m.CreatedAt,
			&m.Username,
			&m.FirstName,
			&m.LastName,
			&photo,
		); err != nil {
			return nil, fmt.Errorf("scan group message: %w", err)
		}
		if photo != "" {
			m.Avatar = "/uploads/" + photo
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group messages: %w", err)
	}

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}