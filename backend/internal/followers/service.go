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

	return s.repo.CreateFollowRequest(requesterID, targetID)
}

func (s *Service) GetPendingFollowRequests(targetID int) ([]FollowRequestWithRequester, error) {
	return s.repo.GetPendingFollowRequests(targetID)
}

func (s *Service) GetFollowers(userID int) ([]UserSummary, error) {
	return s.repo.GetFollowers(userID)
}

func (s *Service) GetFollowing(userID int) ([]UserSummary, error) {
	return s.repo.GetFollowing(userID)
}
