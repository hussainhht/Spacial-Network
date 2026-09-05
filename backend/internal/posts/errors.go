package posts

import (
	"errors"
	"net/http"
)

var errMethodNotAllowed = http.StatusMethodNotAllowed

var (
	// ErrPostNotFound is returned when a post does not exist.
	ErrPostNotFound = errors.New("post not found")
	// ErrForbidden is returned when a user attempts to modify a post they
	// do not own.
	ErrForbidden = errors.New("not allowed to modify this post")
)

