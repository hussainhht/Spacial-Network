package comments

import (
	"database/sql"
	"log"

	"social/internal/notifications"
	"social/internal/posts"
)

type NotificationSender interface {
	Notify(notifications.CreateNotificationRequest) error
}

type Service struct {
	repo         *Repository
	postsService *posts.Service
	notifier     NotificationSender
}

func NewService(repo *Repository, postsService *posts.Service, notifier NotificationSender) *Service {
	return &Service{
		repo:         repo,
		postsService: postsService,
		notifier:     notifier,
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

	s.notifyAuthor(userID, postID)

	return c, nil
}

// notifyAuthor tells postID's author that userID commented on their post,
// provided they aren't commenting on their own post. Best-effort: a
// notification failure never fails the comment itself.
func (s *Service) notifyAuthor(userID, postID int) {
	if s.notifier == nil {
		return
	}

	post, err := s.postsService.GetPostByID(postID)
	if err != nil {
		log.Printf("comments: failed to load post %d for comment notification: %v", postID, err)
		return
	}
	if post.User_ID == userID {
		return
	}

	actor := userID
	entityType := notifications.EntityPost
	entityID := postID
	if err := s.notifier.Notify(notifications.CreateNotificationRequest{
		ReceiverID: post.User_ID,
		ActorID:    &actor,
		Type:       notifications.NotificationPostComment,
		EntityType: &entityType,
		EntityID:   &entityID,
		Message:    "commented on your post",
	}); err != nil {
		log.Printf("comments: post_comment notification for post %d failed: %v", postID, err)
	}
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

// CountComments returns how many comments exist on postID, provided userID
// can view the post. Read-only, so it gates on visibility alone rather
// than on group membership.
func (s *Service) CountComments(userID, postID int) (int, error) {
	canAccess, err := s.postsService.CanAccess(userID, postID)
	if err != nil {
		return 0, err
	}
	if !canAccess {
		return 0, ErrPostNotFound
	}

	return s.repo.CountByPost(postID)
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
