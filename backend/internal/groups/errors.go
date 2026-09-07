package groups

import (
	"errors"
	"net/http"
)

// ErrGroupNotFound is returned when a group with the given ID does not exist.
var ErrInviteeNotFound = errors.New("invited user not found")

var ErrGroupNotFound = errors.New("group not found")

// ErrAlreadyMember is returned when trying to add a user to a group they
// are already a member of.
var ErrAlreadyMember = errors.New("user is already a member of this group")

// ErrInvitationNotFound is returned when a group invitation with the given
// ID does not exist.
var ErrInvitationNotFound = errors.New("group invitation not found")

// ErrJoinRequestNotFound is returned when a group join request with the
// given ID does not exist.
var ErrJoinRequestNotFound = errors.New("group join request not found")

// ErrNotGroupCreator is returned when a non-creator attempts an action
// reserved for the group's creator.
var ErrNotGroupCreator = errors.New("user is not the creator of this group")

// ErrNotGroupMember is returned when a non-member attempts an action
// reserved for group members.
var ErrNotGroupMember = errors.New("user is not a member of this group")

// ErrCannotInviteSelf is returned when a user attempts to invite themself
// to a group.
var ErrCannotInviteSelf = errors.New("cannot invite yourself to a group")

// ErrJoinRequestAlreadyPending is returned when a user already has a
// pending join request for the group.
var ErrJoinRequestAlreadyPending = errors.New("a pending join request already exists")

// ErrJoinRequestNotPending is returned when trying to accept or reject a
// join request that has already been resolved.
var ErrJoinRequestNotPending = errors.New("join request is not pending")

// ErrInvitationAlreadyPending is returned when a user already has a
// pending invitation to the group.
var ErrInvitationAlreadyPending = errors.New("a pending invitation already exists")

// ErrInvitationNotPending is returned when trying to accept or decline an
// invitation that has already been resolved.
var ErrInvitationNotPending = errors.New("invitation is not pending")

// ErrInvalidSearchQuery is returned when the invite-candidate search query
// fails validation (e.g. empty or too long).
var ErrInvalidSearchQuery = errors.New("search query is invalid")

// joinRequestErrorResponse maps a group join request service error to an
// HTTP status code and a user-facing message.
func joinRequestErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrJoinRequestNotFound):
		return http.StatusNotFound, "Join request not found"
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can do this"
	case errors.Is(err, ErrAlreadyMember):
		return http.StatusConflict, "User is already a member of this group"
	case errors.Is(err, ErrJoinRequestAlreadyPending):
		return http.StatusConflict, "A pending join request already exists"
	case errors.Is(err, ErrJoinRequestNotPending):
		return http.StatusConflict, "Join request has already been processed"
	default:
		return http.StatusInternalServerError, "Failed to process join request"
	}
}

// invitationErrorResponse maps a group invitation service error to an HTTP
// status code and a user-facing message.
func invitationErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrInviteeNotFound):
		return http.StatusNotFound, "Invited user not found"
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrInvitationNotFound):
		return http.StatusNotFound, "Invitation not found"
	case errors.Is(err, ErrCannotInviteSelf):
		return http.StatusBadRequest, "Cannot invite yourself to a group"
	case errors.Is(err, ErrNotGroupMember):
		return http.StatusForbidden, "You must be a member of this group to do this"
	case errors.Is(err, ErrAlreadyMember):
		return http.StatusConflict, "User is already a member of this group"
	case errors.Is(err, ErrInvitationAlreadyPending):
		return http.StatusConflict, "A pending invitation already exists"
	case errors.Is(err, ErrInvitationNotPending):
		return http.StatusConflict, "Invitation has already been processed"
	default:
		return http.StatusInternalServerError, "Failed to process invitation"
	}
}

// updateGroupErrorResponse maps an update-group service error to an HTTP
// status code and a user-facing message.
func updateGroupErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can do this"
	default:
		return http.StatusInternalServerError, "Failed to update group"
	}
}

// inviteCandidateErrorResponse maps a search-invite-candidates service error
// to an HTTP status code and a user-facing message.
func inviteCandidateErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrNotGroupMember):
		return http.StatusForbidden, "You must be a member of this group to do this"
	case errors.Is(err, ErrInvalidSearchQuery):
		return http.StatusBadRequest, "Search query must be between 1 and 100 characters"
	default:
		return http.StatusInternalServerError, "Failed to search invite candidates"
	}
}
