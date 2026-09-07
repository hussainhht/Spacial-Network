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

// MaxListPosts is the most posts ListPosts will ever return in one call.
const MaxListPosts = 50

// ListPosts returns up to limit posts visible to viewerID, newest first.
// limit is clamped to the range [1, MaxListPosts]; a limit <= 0 defaults to
// MaxListPosts.
func (s *Service) ListPosts(viewerID, limit int) ([]*post, error) {
	if limit <= 0 || limit > MaxListPosts {
		limit = MaxListPosts
	}
	return s.repo.ListPosts(viewerID, limit)
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

// CanAccess reports whether viewerID may view postID: true for any public
// post or a private post owned by viewerID. It returns ErrPostNotFound if
// the post doesn't exist.
func (s *Service) CanAccess(viewerID, postID int) (bool, error) {
	p, err := s.repo.GetPostByID(postID)
	if err != nil {
		return false, err
	}
	if p.isPrivate && p.User_ID != viewerID {
		return false, nil
	}
	return true, nil
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
