package posts

import (
	"database/sql"

	"social/internal/followers"
	"social/internal/groups"
)

type Service struct {
	repo      *Repository
	followers *followers.Service
	groups    *groups.Service
}

func NewService(repo *Repository, followersService *followers.Service, groupsService *groups.Service) *Service {
	return &Service{
		repo:      repo,
		followers: followersService,
		groups:    groupsService,
	}
}

// CreatePost creates post, then, if its visibility is custom, restricts the
// allowed-viewer list to whichever of viewerIDs are actually followers of
// the post's owner.
func (s *Service) CreatePost(post *post, viewerIDs []int) error {
	var allowed []int
	if post.visibility == VisibilityCustom {
		var err error
		allowed, err = s.followers.FilterFollowerIDs(post.User_ID, viewerIDs)
		if err != nil {
			return err
		}
	}
	return s.repo.CreatePost(post, allowed)
}

func (s *Service) GetPostByID(id int) (*post, error) {
	return s.repo.GetPostByID(id)
}

// CreateGroupPost creates a post inside groupID on behalf of post.User_ID,
// provided that user is currently a member of the group. Group posts don't
// use the public/followers/custom visibility system - they're always
// visible to anyone who can view the group.
func (s *Service) CreateGroupPost(post *post, groupID int) error {
	if _, err := s.groups.GetGroupByID(groupID); err != nil {
		return err
	}

	isMember, err := s.groups.IsGroupMember(groupID, post.User_ID)
	if err != nil {
		return err
	}
	if !isMember {
		return groups.ErrNotGroupMember
	}

	post.GroupID = sql.NullInt64{Int64: int64(groupID), Valid: true}
	post.visibility = VisibilityPublic

	return s.repo.CreatePost(post, nil)
}

// ListGroupPosts returns up to limit posts belonging to groupID, newest
// first. Group privacy controls how membership is obtained, never whether
// non-members may read member content.
func (s *Service) ListGroupPosts(groupID, userID, limit int) ([]*post, error) {
	if limit <= 0 || limit > MaxListPosts {
		limit = MaxListPosts
	}

	if _, err := s.groups.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	isMember, err := s.groups.IsGroupMember(groupID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, groups.ErrNotGroupMember
	}

	return s.repo.ListPostsByGroup(groupID, limit)
}

// GetAllowedViewerIDs returns the user IDs on postID's custom-visibility
// allowed-viewer list.
func (s *Service) GetAllowedViewerIDs(postID int) ([]int, error) {
	return s.repo.GetAllowedViewerIDs(postID)
}

// MaxListPosts is the most posts ListPosts will ever return in one call.
const MaxListPosts = 50

// ListPosts returns up to limit posts visible to viewerID, newest first,
// restricted to feed's author scope (FeedAll, FeedFollowing, or
// FeedFriends - see Repository.ListPosts). limit is clamped to the range
// [1, MaxListPosts]; a limit <= 0 defaults to MaxListPosts.
func (s *Service) ListPosts(viewerID, limit int, feed string) ([]*post, error) {
	return s.ListPostsPage(viewerID, limit, feed, nil)
}

// ListPostsPage returns one cursor-delimited page while preserving the
// existing ListPosts method for callers that only need the first page.
func (s *Service) ListPostsPage(viewerID, limit int, feed string, cursor *FeedCursor) ([]*post, error) {
	if limit <= 0 || limit > MaxListPosts {
		limit = MaxListPosts
	}
	return s.repo.ListPosts(viewerID, limit, feed, cursor)
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
	// Group posts and their comments remain member-only in both public and
	// private groups. Public groups expose metadata and allow join requests;
	// membership still requires creator approval.
	if p.GroupID.Valid {
		return s.groups.IsGroupMember(int(p.GroupID.Int64), viewerID)
	}

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

// CanCreateComment reports whether userID may comment on postID: they must
// be able to view the post and, if it's a group post, also be a current
// member of that group. It returns ErrPostNotFound if the post doesn't
// exist or isn't visible to viewerID, or groups.ErrNotGroupMember if it's a
// group post the viewer isn't a member of.
func (s *Service) CanCreateComment(userID, postID int) error {
	p, err := s.repo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if p.GroupID.Valid {
		isMember, err := s.groups.IsGroupMember(int(p.GroupID.Int64), userID)
		if err != nil {
			return err
		}
		if !isMember {
			return groups.ErrNotGroupMember
		}
	}

	canAccess, err := s.canAccessPost(userID, p)
	if err != nil {
		return err
	}
	if !canAccess {
		return ErrPostNotFound
	}

	return nil
}

// CanModeratePost reports whether userID may moderate (delete) postID: its
// owner always can, and so can the creator of the group it belongs to, if
// any.
func (s *Service) CanModeratePost(userID, postID int) (bool, error) {
	p, err := s.repo.GetPostByID(postID)
	if err != nil {
		return false, err
	}
	return s.canModerate(userID, p)
}

// IsGroupModerator reports whether userID is the creator of the group
// postID belongs to (false, nil if postID isn't a group post). Unlike
// CanModeratePost, it doesn't also check ownership - it's meant to be
// called once and reused across every item that shares postID (e.g. a
// post's comments), rather than re-fetching the post per item.
func (s *Service) IsGroupModerator(userID, postID int) (bool, error) {
	p, err := s.repo.GetPostByID(postID)
	if err != nil {
		return false, err
	}
	if !p.GroupID.Valid {
		return false, nil
	}
	return s.groups.IsGroupCreator(int(p.GroupID.Int64), userID)
}

func (s *Service) canModerate(userID int, p *post) (bool, error) {
	if p.User_ID == userID {
		return true, nil
	}
	if !p.GroupID.Valid {
		return false, nil
	}
	return s.groups.IsGroupCreator(int(p.GroupID.Int64), userID)
}

// DeletePost removes a post, provided userID owns it or is the creator of
// the group it was posted in.
func (s *Service) DeletePost(userID, postID int) error {
	existing, err := s.repo.GetPostByID(postID)
	if err != nil {
		return err
	}

	canModerate, err := s.canModerate(userID, existing)
	if err != nil {
		return err
	}
	if !canModerate {
		return ErrForbidden
	}

	return s.repo.DeletePost(postID)
}
