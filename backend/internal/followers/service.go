package followers

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) FollowUser(followerID, followedID int) error {
	if followerID == followedID {
		return ErrCannotFollowSelf
	}

	return s.repo.FollowUser(followerID, followedID)
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

func (s *Service) GetEligibleChatContacts(userID int) ([]UserSummary, error) {
	return s.repo.GetEligibleChatContacts(userID)
}
