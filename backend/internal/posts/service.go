package posts

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) CreatePost(post *post) error {
	return s.repo.CreatePost(post)
}

func (s *Service) GetPostByID(id int) (*post, error) {
	return s.repo.GetPostByID(id)
}

// UpdatePost updates a post's editable fields, provided userID owns it.
func (s *Service) UpdatePost(userID, postID int, title, content string, private bool) error {
	existing, err := s.repo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if existing.User_ID != userID {
		return ErrForbidden
	}

	existing.Title = title
	existing.Content = content
	existing.isPrivate = private

	return s.repo.UpdatePost(existing)
}

// DeletePost removes a post, provided userID owns it.
func (s *Service) DeletePost(userID, postID int) error {
	existing, err := s.repo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if existing.User_ID != userID {
		return ErrForbidden
	}

	return s.repo.DeletePost(postID)
}
