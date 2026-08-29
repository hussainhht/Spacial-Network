package groups

import "errors"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

// CreateGroup stores a new group owned by creatorID and returns its ID.
func (s *Service) CreateGroup(creatorID int, title, description string) (int64, error) {
	return s.repo.InsertGroup(creatorID, title, description)
}

// GetAllGroups returns a page of groups, most recently created first.
func (s *Service) GetAllGroups(limit, offset int) ([]Group, error) {
	return s.repo.GetAllGroups(limit, offset)
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
