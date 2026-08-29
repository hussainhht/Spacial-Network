package groups

import "errors"

// ErrGroupNotFound is returned when a group with the given ID does not exist.
var ErrGroupNotFound = errors.New("group not found")
