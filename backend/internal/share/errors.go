package share

import "errors"

var (
	// ErrPostNotFound is returned when a post is shared that either
	// doesn't exist or isn't visible to the sharing user - a private post
	// looks the same as one that doesn't exist to anyone else. It also
	// stops a share from leaking a post's existence to someone who
	// couldn't otherwise see it.
	ErrPostNotFound = errors.New("post not found")
	// ErrInvalidTarget is returned when target is neither TargetUser nor
	// TargetGroup.
	ErrInvalidTarget = errors.New("target must be \"user\" or \"group\"")
	// ErrInvalidTargetID is returned when the recipient user or group id
	// is missing or non-positive.
	ErrInvalidTargetID = errors.New("target_id is required")
)
