package likes

import "errors"

var (
	// ErrPostNotFound is returned when a like is requested against a post
	// that either doesn't exist or isn't visible to the requesting user - a
	// private post looks the same as one that doesn't exist to anyone else.
	ErrPostNotFound = errors.New("post not found")
	// ErrLikeNotFound is returned when a user unlikes a post they had not
	// liked in the first place.
	ErrLikeNotFound = errors.New("like not found")
)
