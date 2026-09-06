package groups

import (
	"errors"
	"net/http"
)

var ErrEventNotFound = errors.New("event not found")

func eventErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrEventNotFound):
		return http.StatusNotFound, "Event not found"
	case errors.Is(err, ErrNotGroupMember):
		return http.StatusForbidden, "You must be a member of this group to do this"
	default:
		return http.StatusInternalServerError, "Failed to process event request"
	}
}
