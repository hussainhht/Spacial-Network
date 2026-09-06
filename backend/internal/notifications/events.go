package notifications

import (
	"time"

	"social/internal/websocket"
)

const EventNotification websocket.EventType = "notification"

type NotificationPayload struct {
	ID      int              `json:"id"`
	ActorID *int             `json:"actor_id,omitempty"`
	Type    NotificationType `json:"type"`

	EntityType *string `json:"entity_type,omitempty"`
	EntityID   *int    `json:"entity_id,omitempty"`

	// Display/navigation context is derived from the entity relationship, never authorization evidence.
	GroupID       *int    `json:"group_id,omitempty"`
	GroupTitle    *string `json:"group_title,omitempty"`
	ActorUsername *string `json:"actor_username,omitempty"`
	Message       string  `json:"message"`

	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

func toPayload(n Notification) NotificationPayload {
	return NotificationPayload{
		ID:      n.ID,
		GroupID: n.GroupID, GroupTitle: n.GroupTitle, ActorUsername: n.ActorUsername,
		ActorID:    n.ActorID,
		Type:       n.Type,
		EntityType: n.EntityType,
		EntityID:   n.EntityID,
		Message:    n.Message,
		ReadAt:     n.ReadAt,
		CreatedAt:  n.CreatedAt,
	}
}

func NewNotificationEvent(n Notification) (websocket.Event, error) {
	return websocket.NewEvent(EventNotification, toPayload(n))
}
