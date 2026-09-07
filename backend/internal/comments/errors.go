package comments

import "errors"

var (
	// ErrPostNotFound is returned when a comment is requested against a post
	// that either doesn't exist or isn't visible to the requesting user - a
	// private post looks the same as one that doesn't exist to anyone else.
	ErrPostNotFound = errors.New("post not found")
	// ErrCommentNotFound is returned when a comment does not exist.
	ErrCommentNotFound = errors.New("comment not found")
	// ErrForbidden is returned when a user attempts to delete a comment they
	// do not own.
	ErrForbidden = errors.New("not allowed to modify this comment")
)
