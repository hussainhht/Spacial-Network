package notifications

import "time"

// NotificationType identifies what kind of event a notification represents.
// It is validated in Go (see IsValidNotificationType) rather than with a DB
// CHECK constraint, so new types can be added here without a migration.
type NotificationType string

const (
	NotificationFollowRequest           NotificationType = "follow_request"
	NotificationNewFollower             NotificationType = "new_follower"
	NotificationFollowAccepted          NotificationType = "follow_accepted"
	NotificationGroupInvitation         NotificationType = "group_invitation"
	NotificationGroupInvitationAccepted NotificationType = "group_invitation_accepted"
	NotificationGroupInvitationDeclined NotificationType = "group_invitation_declined"
	NotificationGroupJoinRequest        NotificationType = "group_join_request"
	NotificationGroupJoinAccepted       NotificationType = "group_join_accepted"
	NotificationGroupJoinRejected       NotificationType = "group_join_rejected"
	NotificationGroupEvent              NotificationType = "group_event"
	NotificationEventRSVP               NotificationType = "event_rsvp"
	NotificationGroupMessage            NotificationType = "group_message"
	NotificationPrivateMessage          NotificationType = "private_message"
	NotificationPostLike                NotificationType = "post_like"
	NotificationPostComment             NotificationType = "post_comment"
)

// validNotificationTypes is the single source of truth for which types are
// currently accepted. Adding a new notification type (post_like,
// post_comment, new_follower, mention, reel_like, ...) only requires a new
// const above and an entry here - no schema change.
var validNotificationTypes = map[NotificationType]bool{
	NotificationFollowRequest:           true,
	NotificationNewFollower:             true,
	NotificationFollowAccepted:          true,
	NotificationGroupInvitation:         true,
	NotificationGroupInvitationAccepted: true,
	NotificationGroupInvitationDeclined: true,
	NotificationGroupJoinRequest:        true,
	NotificationGroupJoinAccepted:       true,
	NotificationGroupJoinRejected:       true,
	NotificationGroupEvent:              true,
	NotificationEventRSVP:               true,
	NotificationGroupMessage:            true,
	NotificationPrivateMessage:          true,
	NotificationPostLike:                true,
	NotificationPostComment:             true,
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
	EntityFollow           = "follow"
	EntityGroupInvitation  = "group_invitation"
	EntityGroupJoinRequest = "group_join_request"
	EntityEvent            = "event"
	EntityPrivateMessage   = "private_message"
	EntityGroup            = "group"
	EntityPost             = "post"
)

// Notification is a single row in the notifications table. It carries only
// fields common to every notification type; feature-specific display and
// navigation context (which group, which post, ...) lives in Data instead of
// growing this struct - see GroupNotificationData for the Groups example.
type Notification struct {
	ID         int              `json:"id"`
	ReceiverID int              `json:"receiver_id"`
	ActorID    *int             `json:"actor_id,omitempty"`
	Type       NotificationType `json:"type"`

	EntityType *string `json:"entity_type,omitempty"`
	EntityID   *int    `json:"entity_id,omitempty"`

	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`

	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type GroupNotificationData struct {
	GroupID       int     `json:"group_id"`
	GroupTitle    string  `json:"group_title"`
	ActorUsername *string `json:"actor_username,omitempty"`
}

type FollowNotificationData struct {
	ActorUsername string `json:"actor_username"`
}

type PrivateMessageNotificationData struct {
	ActorUsername string `json:"actor_username"`
}

type CreateNotificationRequest struct {
	ReceiverID int
	ActorID    *int
	Type       NotificationType

	EntityType *string
	EntityID   *int

	Message string
}

type UnreadCountResponse struct {
	Count int `json:"count"`
}

type ListNotificationsResponse struct {
	Notifications []Notification `json:"notifications"`
}
