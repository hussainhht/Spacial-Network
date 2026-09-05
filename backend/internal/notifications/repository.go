package notifications

import (
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(req CreateNotificationRequest) (*Notification, error) {
	query := `
		INSERT INTO notifications (receiver_id, actor_id, type, entity_type, entity_id, message)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, receiver_id, actor_id, type, entity_type, entity_id, message, read_at, created_at
	`

	var n Notification
	var typ string
	err := r.db.QueryRow(
		query,
		req.ReceiverID, req.ActorID, string(req.Type), req.EntityType, req.EntityID, req.Message,
	).Scan(
		&n.ID, &n.ReceiverID, &n.ActorID, &typ, &n.EntityType, &n.EntityID, &n.Message, &n.ReadAt, &n.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}
	n.Type = NotificationType(typ)

	return &n, nil
}

func (r *Repository) GetByUser(userID, limit, offset int) ([]Notification, error) {
	query := `
		SELECT id, receiver_id, actor_id, type, entity_type, entity_id, message, read_at, created_at
		FROM notifications
		WHERE receiver_id = ?
		ORDER BY created_at DESC, id DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query notifications: %w", err)
	}
	defer rows.Close()

	result := make([]Notification, 0)
	for rows.Next() {
		var n Notification
		var typ string
		if err := rows.Scan(
			&n.ID, &n.ReceiverID, &n.ActorID, &typ, &n.EntityType, &n.EntityID, &n.Message, &n.ReadAt, &n.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		n.Type = NotificationType(typ)
		result = append(result, n)
	}

	return result, rows.Err()
}

func (r *Repository) GetUnreadCount(userID int) (int, error) {
	var count int
	err := r.db.QueryRow(
		`SELECT COUNT(*) FROM notifications WHERE receiver_id = ? AND read_at IS NULL`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count unread notifications: %w", err)
	}
	return count, nil
}


func (r *Repository) MarkAsRead(notificationID, receiverID int) error {
	result, err := r.db.Exec(
		`UPDATE notifications SET read_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND receiver_id = ? AND read_at IS NULL`,
		notificationID, receiverID,
	)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	if affected > 0 {
		return nil
	}

	// No rows changed: either the notification was already read (fine, a
	// no-op), or it doesn't exist / isn't owned by receiverID (an error).
	owned, err := r.belongsToReceiver(notificationID, receiverID)
	if err != nil {
		return err
	}
	if !owned {
		return ErrNotificationNotFound
	}
	return nil
}

func (r *Repository) MarkAllAsRead(receiverID int) error {
	_, err := r.db.Exec(
		`UPDATE notifications SET read_at = CURRENT_TIMESTAMP
		 WHERE receiver_id = ? AND read_at IS NULL`,
		receiverID,
	)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

func (r *Repository) belongsToReceiver(notificationID, receiverID int) (bool, error) {
	var one int
	err := r.db.QueryRow(
		`SELECT 1 FROM notifications WHERE id = ? AND receiver_id = ?`,
		notificationID, receiverID,
	).Scan(&one)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("check notification ownership: %w", err)
	}
	return true, nil
}
