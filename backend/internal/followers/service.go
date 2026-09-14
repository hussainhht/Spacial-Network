package followers

import (
	"log"

	"social/internal/notifications"
)

type NotificationSender interface {
	Notify(notifications.CreateNotificationRequest) error
}

type Service struct {
	repo     *Repository
	notifier NotificationSender
}

func NewService(repo *Repository, notifier NotificationSender) *Service {
	return &Service{
		repo:     repo,
		notifier: notifier,
	}
}

func (s *Service) FollowUser(followerID, followedID int) error {
	if followerID == followedID {
		return ErrCannotFollowSelf
	}

	followID, err := s.repo.FollowUser(followerID, followedID)
	if err != nil {
		return err
	}

	s.notify(
		followedID,
		followerID,
		notifications.NotificationNewFollower,
		notifications.EntityFollow,
		int(followID),
		"started following you",
	)

	return nil
}

func (s *Service) UnfollowUser(followerID, followedID int) error {
	if followerID == followedID {
		return ErrCannotFollowSelf
	}

	return s.repo.UnfollowUser(followerID, followedID)
}

func (s *Service) IsFollowing(followerID, followedID int) (bool, error) {
	if followerID == followedID {
		return false, nil
	}

	return s.repo.IsFollowing(followerID, followedID)
}

func (s *Service) HasPendingFollowRequest(requesterID, targetID int) (bool, error) {
	if requesterID == targetID {
		return false, nil
	}

	return s.repo.HasPendingFollowRequest(requesterID, targetID)
}

func (s *Service) CreateFollowRequest(requesterID, targetID int) error {
	if requesterID == targetID {
		return ErrCannotFollowSelf
	}

	isFollowing, err := s.repo.IsFollowing(requesterID, targetID)
	if err != nil {
		return err
	}
	if isFollowing {
		return ErrAlreadyFollowing
	}

	requestID, err := s.repo.CreateFollowRequest(requesterID, targetID)
	if err != nil {
		return err
	}

	s.notify(
		targetID,
		requesterID,
		notifications.NotificationFollowRequest,
		notifications.EntityFollowRequest,
		int(requestID),
		"wants to follow you",
	)

	return nil
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
		log.Printf("followers: %s notification for entity %d failed: %v", notifType, entityID, err)
	}
}

func (s *Service) GetPendingFollowRequests(targetID int) ([]FollowRequestWithRequester, error) {
	return s.repo.GetPendingFollowRequests(targetID)
}

func (s *Service) AcceptFollowRequest(requestID, targetID int) error {
	return s.repo.AcceptFollowRequest(requestID, targetID)
}

func (s *Service) DeclineFollowRequest(requestID, targetID int) error {
	return s.repo.DeclineFollowRequest(requestID, targetID)
}

// FilterFollowerIDs returns the subset of candidateIDs that currently
// follow followedID.
func (s *Service) FilterFollowerIDs(followedID int, candidateIDs []int) ([]int, error) {
	return s.repo.FilterFollowerIDs(followedID, candidateIDs)
}

func (s *Service) GetFollowers(userID int) ([]UserSummary, error) {
	return s.repo.GetFollowers(userID)
}

func (s *Service) GetFollowing(userID int) ([]UserSummary, error) {
	return s.repo.GetFollowing(userID)
}

func (s *Service) CanMessage(userA, userB int) (bool, error) {
	if userA == userB {
		return false, nil
	}

	return s.repo.HasFollowRelationship(userA, userB)
}

func (s *Service) GetEligibleChatContacts(userID int, search string, contactID int, limit, offset int) ([]UserSummary, error) {
	if userID <= 0 {
		return []UserSummary{}, nil
	}
	return s.repo.GetEligibleChatContacts(userID, search, contactID, limit, offset)
}
