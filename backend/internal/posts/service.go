package posts

import "social/internal/followers"

type Service struct {
	repo      *Repository
	followers *followers.Service
}

func NewService(repo *Repository, followersService *followers.Service) *Service {
	return &Service{
		repo:      repo,
		followers: followersService,
	}
}

// CreatePost creates post, then, if its visibility is custom, restricts the
// allowed-viewer list to whichever of viewerIDs are actually followers of
// the post's owner.
func (s *Service) CreatePost(post *post, viewerIDs []int) error {
	if err := s.repo.CreatePost(post); err != nil {
		return err
	}

	if post.visibility != VisibilityCustom {
		return nil
	}

	allowed, err := s.followers.FilterFollowerIDs(post.User_ID, viewerIDs)
	if err != nil {
		return err
	}

	return s.repo.SetAllowedViewerIDs(post.ID, allowed)
}

func (s *Service) GetPostByID(id int) (*post, error) {
	return s.repo.GetPostByID(id)
}

// GetAllowedViewerIDs returns the user IDs on postID's custom-visibility
// allowed-viewer list.
func (s *Service) GetAllowedViewerIDs(postID int) ([]int, error) {
	return s.repo.GetAllowedViewerIDs(postID)
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

// UpdatePost updates a post's editable fields, provided userID owns it. If
// visibility is custom, the allowed-viewer list is replaced with whichever
// of viewerIDs are actually followers of userID; for any other visibility
// viewerIDs is ignored and the existing allowed-viewer list (if any) is left
// untouched, so it's restored unchanged if the post is later switched back
// to custom.
func (s *Service) UpdatePost(userID, postID int, title, content, visibility string, viewerIDs []int) error {
	existing, err := s.repo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if existing.User_ID != userID {
		return ErrForbidden
	}

	existing.Title = title
	existing.Content = content
	existing.visibility = visibility

	if err := s.repo.UpdatePost(existing); err != nil {
		return err
	}

	if visibility != VisibilityCustom {
		return nil
	}

	allowed, err := s.followers.FilterFollowerIDs(userID, viewerIDs)
	if err != nil {
		return err
	}

	return s.repo.SetAllowedViewerIDs(postID, allowed)
}

// CanAccess reports whether viewerID may view postID: the owner can always
// access their own post; a public post is visible to everyone; a
// followers-only post is visible to the owner's followers; a custom post is
// visible to whichever of the owner's followers are on its allowed-viewer
// list. It returns ErrPostNotFound if the post doesn't exist.
func (s *Service) CanAccess(viewerID, postID int) (bool, error) {
	p, err := s.repo.GetPostByID(postID)
	if err != nil {
		return false, err
	}
	return s.canAccessPost(viewerID, p)
}

func (s *Service) canAccessPost(viewerID int, p *post) (bool, error) {
	if p.User_ID == viewerID {
		return true, nil
	}

	switch p.visibility {
	case VisibilityPublic:
		return true, nil
	case VisibilityFollowers:
		return s.followers.IsFollowing(viewerID, p.User_ID)
	case VisibilityCustom:
		isViewer, err := s.repo.IsAllowedViewer(p.ID, viewerID)
		if err != nil || !isViewer {
			return false, err
		}
		return s.followers.IsFollowing(viewerID, p.User_ID)
	default:
		return false, nil
	}
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
