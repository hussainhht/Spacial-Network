package groups

import (
	"errors"
	"log"

	"social/internal/notifications"
	"social/internal/websocket"
)

type Service struct {
	repo     *Repository
	notifier NotificationSender
	hub      *websocket.Hub
}

func NewService(
	repo *Repository, notifier NotificationSender, hub *websocket.Hub) *Service {
	return &Service{
		repo:     repo,
		notifier: notifier,
		hub:      hub,
	}
}


type NotificationSender interface {
	Notify(notifications.CreateNotificationRequest) error
}


func (s *Service) notify(receiverID, actorID int, notifType notifications.NotificationType, entityType string, entityID int, message string) {
	if s.notifier == nil {
		return
	}

	actor := actorID
	et := entityType
	eid := entityID
	if err := s.notifier.Notify(notifications.CreateNotificationRequest{
		ReceiverID: receiverID,
		ActorID:    &actor,
		Type:       notifType,
		EntityType: &et,
		EntityID:   &eid,
		Message:    message,
	}); err != nil {
		log.Printf("groups: %s notification for entity %d failed: %v", notifType, entityID, err)
	}
}

// CreateGroup stores a new group owned by creatorID and returns its ID.
func (s *Service) CreateGroup(creatorID int, title, description string) (int64, error) {
	return s.repo.InsertGroup(creatorID, title, description)
}

// GetAllGroups returns a page of groups, most recently created first.
func (s *Service) GetAllGroups(limit, offset, userID int) ([]Group, error) {
	return s.repo.GetAllGroups(limit, offset, userID)
}

// GetGroupByID returns the group with the given ID.
func (s *Service) GetGroupByID(id int) (*Group, error) {
	return s.repo.GetGroupByID(id)
}

// GetGroupMembers returns the members of a group, or ErrGroupNotFound if the
// group doesn't exist.
func (s *Service) GetGroupMembers(groupID int) ([]GroupMember, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	return s.repo.GetGroupMembers(groupID)
}

func (s *Service) IsGroupMember(groupID, userID int) (bool, error) {
	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return false, err
	}
	return member != nil, nil
}

func (s *Service) GetMembership(groupID, userID int) (*GroupMember, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	return s.repo.GetMembership(groupID, userID)
}

func (s *Service) IsGroupCreator(groupID, userID int) (bool, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		if errors.Is(err, ErrGroupNotFound) {
			return false, nil
		}
		return false, err
	}
	return group.CreatorID == userID, nil
}

func (s *Service) AddMember(groupID, userID int) error {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return err
	}
	return s.repo.AddMember(groupID, userID)
}

func (s *Service) RequestToJoin(groupID, userID int) error {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return err
	}

	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return err
	}
	if member != nil {
		return ErrAlreadyMember
	}

	pending, err := s.repo.HasPendingJoinRequest(groupID, userID)
	if err != nil {
		return err
	}
	if pending {
		return ErrJoinRequestAlreadyPending
	}

	requestID, err := s.repo.CreateGroupJoinRequest(groupID, userID)
	if err != nil {
		return err
	}

	s.notify(
		group.CreatorID, // receiver
		userID,          // actor
		notifications.NotificationGroupJoinRequest,
		notifications.EntityGroupJoinRequest,
		int(requestID),
		"requested to join your group",
	)

	return nil
}

func (s *Service) GetPendingJoinRequests(groupID, creatorID int) ([]GroupJoinRequest, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if group.CreatorID != creatorID {
		return nil, ErrNotGroupCreator
	}

	return s.repo.GetPendingJoinRequestsByGroup(groupID)
}

func (s *Service) AcceptJoinRequest(groupID, requestID, creatorID int) error {
	return s.repo.RespondToJoinRequest(groupID, requestID, creatorID, StatusAccepted)
}
func (s *Service) RejectJoinRequest(groupID, requestID, creatorID int) error {
	return s.repo.RespondToJoinRequest(groupID, requestID, creatorID, StatusDeclined)
}
func (s *Service) HasPendingJoinRequest(groupID, userID int) (bool, error) {
	return s.repo.HasPendingJoinRequest(groupID, userID)
}

func (s *Service) CreateGroupInvitation(groupID, inviterID, invitedUserID int) error {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return err
	}

	if inviterID == invitedUserID {
		return ErrCannotInviteSelf
	}

	inviter, err := s.repo.GetMembership(groupID, inviterID)
	if err != nil {
		return err
	}
	if inviter == nil {
		return ErrNotGroupMember
	}

	exists, err := s.repo.UserExists(invitedUserID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrInviteeNotFound
	}

	invited, err := s.repo.GetMembership(groupID, invitedUserID)
	if err != nil {
		return err
	}
	if invited != nil {
		return ErrAlreadyMember
	}

	pending, err := s.repo.HasPendingInvitation(groupID, invitedUserID)
	if err != nil {
		return err
	}
	if pending {
		return ErrInvitationAlreadyPending
	}

	invitationID, err := s.repo.CreateGroupInvitation(groupID, inviterID, invitedUserID)
	if err != nil {
		return err
	}

	s.notify(
		invitedUserID, // receiver
		inviterID,     // actor
		notifications.NotificationGroupInvitation,
		notifications.EntityGroupInvitation,
		int(invitationID),
		"invited you to join a group",
	)

	return nil
}

func (s *Service) GetPendingInvitations(userID int) ([]GroupInvitation, error) {
	return s.repo.GetPendingInvitationsByUser(userID)
}

func (s *Service) AcceptGroupInvitation(invitationID, userID int) error {
	return s.repo.RespondToInvitation(invitationID, userID, StatusAccepted)
}
func (s *Service) DeclineGroupInvitation(invitationID, userID int) error {
	return s.repo.RespondToInvitation(invitationID, userID, StatusDeclined)
}

func (s *Service) SearchInviteCandidates(groupID, currentUserID int, rawQuery string, limit int) ([]InviteCandidate, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}

	member, err := s.repo.GetMembership(groupID, currentUserID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrNotGroupMember
	}

	query, err := ValidateInviteSearchQuery(rawQuery)
	if err != nil {
		return nil, ErrInvalidSearchQuery
	}

	if limit <= 0 {
		limit = DefaultInviteCandidateLimit
	}
	if limit > MaxInviteCandidateLimit {
		limit = MaxInviteCandidateLimit
	}

	return s.repo.SearchInviteCandidates(groupID, currentUserID, query, limit)
}
