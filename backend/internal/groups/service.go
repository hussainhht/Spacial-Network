package groups

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
