package likes

import (
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

	s.notifyAuthor(userID, postID)

	return s.repo.GetStatus(postID, userID)
}

// notifyAuthor tells postID's author that userID liked their post, provided
// they aren't liking their own post. Best-effort: a notification failure
// never fails the like itself.
func (s *Service) notifyAuthor(userID, postID int) {
	if s.notifier == nil {
		return
	}

	post, err := s.postsService.GetPostByID(postID)
	if err != nil {
		log.Printf("likes: failed to load post %d for like notification: %v", postID, err)
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
		Type:       notifications.NotificationPostLike,
		EntityType: &entityType,
		EntityID:   &entityID,
		Message:    "liked your post",
	}); err != nil {
		log.Printf("likes: post_like notification for post %d failed: %v", postID, err)
	}
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
