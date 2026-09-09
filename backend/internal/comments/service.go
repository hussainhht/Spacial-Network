package comments

import (
	"database/sql"

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

// CreateComment adds a comment to postID on behalf of userID, provided
// userID can comment on the post: they must be able to view it, and if
// it's a group post, also be a current member of that group. imagePath is
// the already-saved relative path of an optional image/GIF attachment.
func (s *Service) CreateComment(userID, postID int, content string, imagePath sql.NullString) (*comment, error) {
	if err := s.postsService.CanCreateComment(userID, postID); err != nil {
		return nil, err
	}

	c := &comment{
		PostID:    postID,
		UserID:    userID,
		Content:   content,
		ImagePath: imagePath,
	}
	if err := s.repo.CreateComment(c); err != nil {
		return nil, err
	}

	return c, nil
}

// ListComments returns every comment on postID, oldest first, provided
// userID can view the post.
func (s *Service) ListComments(userID, postID int) ([]*comment, error) {
	canAccess, err := s.postsService.CanAccess(userID, postID)
	if err != nil {
		return nil, err
	}
	if !canAccess {
		return nil, ErrPostNotFound
	}

	return s.repo.ListCommentsByPost(postID)
}

// IsGroupModerator reports whether userID is the creator of the group that
// postID's post belongs to (false, nil if it isn't a group post). Meant to
// be looked up once per request and reused across every comment on that
// post, rather than re-fetching the post per comment.
func (s *Service) IsGroupModerator(userID, postID int) (bool, error) {
	return s.postsService.IsGroupModerator(userID, postID)
}

// DeleteComment removes a comment, provided userID owns it or is the
// creator of the group the comment's post belongs to.
func (s *Service) DeleteComment(userID, commentID int) error {
	existing, err := s.repo.GetCommentByID(commentID)
	if err != nil {
		return err
	}

	if existing.UserID != userID {
		isModerator, err := s.postsService.IsGroupModerator(userID, existing.PostID)
		if err != nil {
			return err
		}
		if !isModerator {
			return ErrForbidden
		}
	}

	return s.repo.DeleteComment(commentID)
}
