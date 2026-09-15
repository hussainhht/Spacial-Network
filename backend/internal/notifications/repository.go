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

	// Use the same projection as REST before live delivery, including completed entities.
	return r.getByID(n.ID, n.ReceiverID)
}

func (r *Repository) GetByUser(userID, limit, offset int) ([]Notification, error) {
	query := notificationSelect + ` WHERE n.receiver_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query notifications: %w", err)
	}
	defer rows.Close()

	result := make([]Notification, 0)
	for rows.Next() {
		var n Notification
		var typ string
		var groupID *int
		var groupTitle, actorUsername *string
		if err := rows.Scan(
			&n.ID, &n.ReceiverID, &n.ActorID, &typ, &n.EntityType, &n.EntityID, &n.Message, &n.ReadAt, &n.CreatedAt, &groupID, &groupTitle, &actorUsername,
		); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		n.Type = NotificationType(typ)
		n.Data = buildNotificationData(n.Type, groupID, groupTitle, actorUsername)
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

// LEFT JOIN preserves historical notifications whose related entity was deleted.
// No pending filter: completed attempts still resolve to their original group.
const notificationSelect = `SELECT n.id, n.receiver_id, n.actor_id, n.type, n.entity_type, n.entity_id,
 n.message, n.read_at, n.created_at, g.id, g.title, u.username
 FROM notifications n
 LEFT JOIN group_invitations i ON n.entity_type = 'group_invitation' AND n.entity_id = i.id
 LEFT JOIN group_join_requests jr ON n.entity_type = 'group_join_request' AND n.entity_id = jr.id
 LEFT JOIN groups g ON g.id = COALESCE(i.group_id, jr.group_id)
 LEFT JOIN users u ON u.id = n.actor_id`

func (r *Repository) getByID(id, receiverID int) (*Notification, error) {
	var n Notification
	var typ string
	var groupID *int
	var groupTitle, actorUsername *string
	err := r.db.QueryRow(notificationSelect+` WHERE n.id = ? AND n.receiver_id = ?`, id, receiverID).Scan(
		&n.ID, &n.ReceiverID, &n.ActorID, &typ, &n.EntityType, &n.EntityID, &n.Message, &n.ReadAt, &n.CreatedAt,
		&groupID, &groupTitle, &actorUsername,
	)
	if err != nil {
		return nil, fmt.Errorf("load notification context: %w", err)
	}
	n.Type = NotificationType(typ)
	n.Data = buildNotificationData(n.Type, groupID, groupTitle, actorUsername)
	return &n, nil
}

func buildNotificationData(notificationType NotificationType, groupID *int, groupTitle, actorUsername *string) any {
	switch notificationType {
	case NotificationGroupInvitation, NotificationGroupJoinRequest:
		return buildGroupData(groupID, groupTitle, actorUsername)
	case NotificationFollowRequest, NotificationNewFollower:
		return buildFollowData(actorUsername)
	default:
		return nil
	}
}

func buildGroupData(groupID *int, groupTitle, actorUsername *string) any {
	if groupID == nil || groupTitle == nil {
		return nil
	}
	return &GroupNotificationData{
		GroupID:       *groupID,
		GroupTitle:    *groupTitle,
		ActorUsername: actorUsername,
	}
}

func buildFollowData(actorUsername *string) any {
	if actorUsername == nil {
		return nil
	}

	return &FollowNotificationData{
		ActorUsername: *actorUsername,
	}
}
