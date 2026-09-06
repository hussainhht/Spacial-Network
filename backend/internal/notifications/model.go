package notifications

import "time"

// NotificationType identifies what kind of event a notification represents.
// It is validated in Go (see IsValidNotificationType) rather than with a DB
// CHECK constraint, so new types can be added here without a migration.
type NotificationType string

const (
	NotificationFollowRequest    NotificationType = "follow_request"
	NotificationGroupInvitation  NotificationType = "group_invitation"
	NotificationGroupJoinRequest NotificationType = "group_join_request"
	NotificationGroupEvent       NotificationType = "group_event"
)

// validNotificationTypes is the single source of truth for which types are
// currently accepted. Adding a new notification type (post_like,
// post_comment, new_follower, mention, reel_like, ...) only requires a new
// const above and an entry here - no schema change.
var validNotificationTypes = map[NotificationType]bool{
	NotificationFollowRequest:    true,
	NotificationGroupInvitation:  true,
	NotificationGroupJoinRequest: true,
	NotificationGroupEvent:       true,
}

// IsValidNotificationType reports whether t is a known notification type.
func IsValidNotificationType(t NotificationType) bool {
	return validNotificationTypes[t]
}

// Entity type labels for the optional entity_type/entity_id pair, describing
// what row a notification refers to. Kept as plain string constants (rather
// than their own enum) since entity_type is an open, descriptive field.
const (
	EntityFollowRequest    = "follow_request"
	EntityGroupInvitation  = "group_invitation"
	EntityGroupJoinRequest = "group_join_request"
	EntityEvent            = "event"
)

// Notification is a single row in the notifications table.
type Notification struct {
	ID         int              `json:"id"`
	ReceiverID int              `json:"receiver_id"`
	ActorID    *int             `json:"actor_id,omitempty"`
	Type       NotificationType `json:"type"`

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

// CreateNotificationRequest is the input other features pass to
// Service.Create. It intentionally has no notion of SQL - callers only ever
// see this struct and the Service methods below.
type CreateNotificationRequest struct {
	ReceiverID int
	ActorID    *int
	Type       NotificationType

	EntityType *string
	EntityID   *int

	Message string
}

// UnreadCountResponse is the JSON body for GET /notifications/unread-count.
type UnreadCountResponse struct {
	Count int `json:"count"`
}

// ListNotificationsResponse is the JSON body for GET /notifications.
type ListNotificationsResponse struct {
	Notifications []Notification `json:"notifications"`
}
