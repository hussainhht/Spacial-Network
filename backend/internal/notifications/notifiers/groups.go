package notifiers

import "social/internal/notifications"

// GroupNotifier adapts notifications.Service to the groups package's
// NotificationSender interface (implemented structurally - this package
// never imports groups), turning group invitation/join-request events into
// stored notifications.
type GroupNotifier struct {
	service *notifications.Service
}

func NewGroupNotifier(service *notifications.Service) *GroupNotifier {
	return &GroupNotifier{service: service}
}

func (n *GroupNotifier) NotifyGroupInvitation(receiverID, actorID, invitationID int) error {
	entityType := notifications.EntityGroupInvitation
	actor := actorID
	_, err := n.service.Create(notifications.CreateNotificationRequest{
		ReceiverID: receiverID,
		ActorID:    &actor,
		Type:       notifications.NotificationGroupInvitation,
		EntityType: &entityType,
		EntityID:   &invitationID,
		Message:    "invited you to join a group",
	})
	return err
}

func (n *GroupNotifier) NotifyGroupJoinRequest(receiverID, actorID, requestID int) error {
	entityType := notifications.EntityGroupJoinRequest
	actor := actorID
	_, err := n.service.Create(notifications.CreateNotificationRequest{
		ReceiverID: receiverID,
		ActorID:    &actor,
		Type:       notifications.NotificationGroupJoinRequest,
		EntityType: &entityType,
		EntityID:   &requestID,
		Message:    "requested to join your group",
	})
	return err
}
