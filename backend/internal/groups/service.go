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
func (s *Service) CreateGroup(creatorID int, title, description, photoPath string, privacy GroupPrivacy) (int64, error) {
	privacy, err := ValidatePrivacy(string(privacy))
	if err != nil {
		return 0, err
	}
	return s.repo.InsertGroup(creatorID, title, description, photoPath, privacy)
}

// GetAllGroups returns a page of groups, most recently created first.
// search, when non-empty, filters to groups whose title or description
// contains it (case-insensitive).
func (s *Service) GetAllGroups(limit, offset, userID int, search string) ([]Group, error) {
	return s.repo.GetAllGroups(limit, offset, userID, search)
}

// GetUserGroups returns a page of groups the given user actually belongs to
// (creator or member), most recently created first. search, when non-empty,
// filters to groups whose title or description contains it
// (case-insensitive).
func (s *Service) GetUserGroups(userID, limit, offset int, search string) ([]Group, error) {
	return s.repo.GetGroupsForUser(userID, limit, offset, search)
}

// GetGroupByID returns the group with the given ID.
func (s *Service) GetGroupByID(id int) (*Group, error) {
	return s.repo.GetGroupByID(id)
}

// GetGroupForUser returns public group metadata to any authenticated user,
// while hiding private groups from everyone except their creator or members.
func (s *Service) GetGroupForUser(groupID, userID int) (*Group, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCanViewGroup(group, userID); err != nil {
		return nil, err
	}
	return group, nil
}

func (s *Service) ensureCanViewGroup(group *Group, userID int) error {
	switch group.Privacy {
	case GroupPrivacyPublic:
		return nil
	case GroupPrivacyPrivate:
		if group.CreatorID == userID {
			return nil
		}
		member, err := s.repo.GetMembership(group.ID, userID)
		if err != nil {
			return err
		}
		if member != nil {
			return nil
		}
	}

	// Use the existing hidden-resource convention so private group existence is
	// not disclosed to unrelated users.
	return ErrGroupNotFound
}

func (s *Service) UpdateGroup(groupID, userID int, title, description string, photoPath *string) (*Group, string, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, "", err
	}
	if group.CreatorID != userID {
		return nil, "", ErrNotGroupCreator
	}
	oldPhoto := group.GroupPhoto

	if err := s.repo.UpdateGroup(groupID, title, description, photoPath); err != nil {
		return nil, "", err
	}

	updated, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, "", err
	}
	return updated, oldPhoto, nil
}

// DeleteGroup permanently deletes groupID on behalf of actorID. Only the
// group's creator may delete it. On success it returns the group's photo
// path (possibly empty) so the caller can clean up the stored file.
func (s *Service) DeleteGroup(groupID, actorID int) (string, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return "", err
	}
	if group.CreatorID != actorID {
		return "", ErrNotGroupCreator
	}

	if err := s.repo.DeleteGroup(groupID); err != nil {
		return "", err
	}

	return group.GroupPhoto, nil
}

func (s *Service) GetGroupMembers(groupID int) ([]GroupMember, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	return s.repo.GetGroupMembers(groupID)
}

// GetVisibleGroupMembers protects the HTTP member-list endpoint for private
// groups while retaining GetGroupMembers for internal member broadcasts.
func (s *Service) GetVisibleGroupMembers(groupID, userID int) ([]GroupMember, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCanViewGroup(group, userID); err != nil {
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
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return nil, err
	}
	if group.Privacy == GroupPrivacyPrivate && group.CreatorID != userID && member == nil {
		return nil, ErrGroupNotFound
	}
	return member, nil
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

// RemoveMember removes memberID's membership from groupID, on behalf of
// actorID. Only the group's creator may remove another member, and the
// creator can never be removed through this operation.
func (s *Service) RemoveMember(groupID, actorID, memberID int) error {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return err
	}
	if group.CreatorID != actorID {
		return ErrNotGroupCreator
	}

	member, err := s.repo.GetMembership(groupID, memberID)
	if err != nil {
		return err
	}
	if member == nil {
		return ErrMemberNotFound
	}

	if memberID == group.CreatorID {
		return ErrCannotRemoveCreator
	}

	return s.repo.RemoveMember(groupID, memberID)
}

// RequestToJoin creates an approval request for a public group. Private groups
// are invite-only and can never be joined through this flow.
func (s *Service) RequestToJoin(groupID, userID int) error {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return err
	}
	if group.Privacy != GroupPrivacyPublic {
		return ErrJoinRequestNotAllowed
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
	if group.Privacy != GroupPrivacyPublic {
		return nil, ErrJoinRequestNotAllowed
	}

	return s.repo.GetPendingJoinRequestsByGroup(groupID)
}

func (s *Service) AcceptJoinRequest(groupID, requestID, creatorID int) error {
	jr, err := s.repo.GetGroupJoinRequestByID(requestID)
	if err != nil {
		return err
	}
	if err := s.repo.RespondToJoinRequest(groupID, requestID, creatorID, StatusAccepted); err != nil {
		return err
	}
	s.notify(jr.UserID, creatorID, notifications.NotificationGroupJoinAccepted, notifications.EntityGroupJoinRequest, requestID, "accepted your request to join the group")
	return nil
}
func (s *Service) RejectJoinRequest(groupID, requestID, creatorID int) error {
	jr, err := s.repo.GetGroupJoinRequestByID(requestID)
	if err != nil {
		return err
	}
	if err := s.repo.RespondToJoinRequest(groupID, requestID, creatorID, StatusDeclined); err != nil {
		return err
	}
	s.notify(jr.UserID, creatorID, notifications.NotificationGroupJoinRejected, notifications.EntityGroupJoinRequest, requestID, "declined your request to join the group")
	return nil
}
func (s *Service) HasPendingJoinRequest(groupID, userID int) (bool, error) {
	return s.repo.HasPendingJoinRequest(groupID, userID)
}

func (s *Service) CreateGroupInvitation(groupID, inviterID, invitedUserID int) error {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return err
	}
	if group.CreatorID != inviterID {
		return ErrNotGroupCreator
	}

	if inviterID == invitedUserID {
		return ErrCannotInviteSelf
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
	inv, err := s.repo.GetGroupInvitationByID(invitationID)
	if err != nil {
		return err
	}
	if err := s.repo.RespondToInvitation(invitationID, userID, StatusAccepted); err != nil {
		return err
	}
	s.notify(inv.InvitedBy, userID, notifications.NotificationGroupInvitationAccepted, notifications.EntityGroupInvitation, invitationID, "accepted your group invitation")
	return nil
}
func (s *Service) DeclineGroupInvitation(invitationID, userID int) error {
	inv, err := s.repo.GetGroupInvitationByID(invitationID)
	if err != nil {
		return err
	}
	if err := s.repo.RespondToInvitation(invitationID, userID, StatusDeclined); err != nil {
		return err
	}
	s.notify(inv.InvitedBy, userID, notifications.NotificationGroupInvitationDeclined, notifications.EntityGroupInvitation, invitationID, "declined your group invitation")
	return nil
}

func (s *Service) SearchInviteCandidates(groupID, currentUserID int, rawQuery string, limit int) ([]InviteCandidate, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if group.CreatorID != currentUserID {
		return nil, ErrNotGroupCreator
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
