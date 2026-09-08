package followers

import "errors"

var (
	ErrCannotFollowSelf            = errors.New("cannot follow yourself")
	ErrAlreadyFollowing            = errors.New("already following this user")
	ErrPrivateProfile              = errors.New("profile is private")
	ErrFollowRequestNotFound       = errors.New("follow request not found")
	ErrFollowRequestAlreadyPending = errors.New("follow request already pending")
	ErrFollowRequestNotPending     = errors.New("follow request is not pending")
)
