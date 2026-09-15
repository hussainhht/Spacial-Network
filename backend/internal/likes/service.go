package likes

import (
	"social/internal/posts"
)

type Service struct {
	repo         *Repository
	postsService *posts.Service
}

func NewService(repo *Repository, postsService *posts.Service) *Service {
	return &Service{
		repo:         repo,
		postsService: postsService,
	}
}

// LikePost records userID's like of postID, provided userID can interact
// with the post: they must be able to view it, and if it's a group post,
// also be a current member of that group. Liking an already-liked post
// succeeds without creating a second like.
func (s *Service) LikePost(userID, postID int) (*LikeStatus, error) {
	if err := s.postsService.CanCreateComment(userID, postID); err != nil {
		return nil, err
	}

	l := &like{
		PostID: postID,
		UserID: userID,
	}
	if err := s.repo.CreateLike(l); err != nil {
		return nil, err
	}

	return s.repo.GetStatus(postID, userID)
}

// UnlikePost removes userID's like of postID. It uses the same permission
// gate as liking, so a user who has lost access to a post can't toggle its
// like state either way.
func (s *Service) UnlikePost(userID, postID int) (*LikeStatus, error) {
	if err := s.postsService.CanCreateComment(userID, postID); err != nil {
		return nil, err
	}

	if err := s.repo.DeleteLike(postID, userID); err != nil {
		return nil, err
	}

	return s.repo.GetStatus(postID, userID)
}

// GetStatus returns postID's like count together with whether userID has
// liked it, provided userID can view the post. Read-only, so it gates on
// visibility alone rather than on group membership.
func (s *Service) GetStatus(userID, postID int) (*LikeStatus, error) {
	if err := s.canView(userID, postID); err != nil {
		return nil, err
	}

	return s.repo.GetStatus(postID, userID)
}

// CountLikes returns how many users have liked postID, provided userID can
// view the post.
func (s *Service) CountLikes(userID, postID int) (int, error) {
	if err := s.canView(userID, postID); err != nil {
		return 0, err
	}

	return s.repo.CountLikesByPost(postID)
}

// HasLiked reports whether userID has liked postID, provided userID can
// view the post.
func (s *Service) HasLiked(userID, postID int) (bool, error) {
	if err := s.canView(userID, postID); err != nil {
		return false, err
	}

	return s.repo.HasLiked(postID, userID)
}

// canView collapses the visibility check shared by every read path: a post
// the viewer can't see is reported as missing rather than forbidden.
func (s *Service) canView(userID, postID int) error {
	canAccess, err := s.postsService.CanAccess(userID, postID)
	if err != nil {
		return err
	}
	if !canAccess {
		return ErrPostNotFound
	}

	return nil
}
