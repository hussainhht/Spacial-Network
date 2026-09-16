package groups

import (
	"errors"
	"net/http"
)

var (
	ErrInviteeNotFound           = errors.New("invited user not found")
	ErrGroupNotFound             = errors.New("group not found")
	ErrAlreadyMember             = errors.New("user is already a member of this group")
	ErrInvitationNotFound        = errors.New("group invitation not found")
	ErrJoinRequestNotFound       = errors.New("group join request not found")
	ErrNotGroupCreator           = errors.New("user is not the creator of this group")
	ErrNotGroupMember            = errors.New("user is not a member of this group")
	ErrCannotInviteSelf          = errors.New("cannot invite yourself to a group")
	ErrJoinRequestAlreadyPending = errors.New("a pending join request already exists")
	ErrJoinRequestNotAllowed     = errors.New("join requests are not allowed for this group")
	ErrJoinRequestNotPending     = errors.New("join request is not pending")
	ErrInvitationAlreadyPending  = errors.New("a pending invitation already exists")
	ErrInvitationNotPending      = errors.New("invitation is not pending")
	ErrInvalidSearchQuery        = errors.New("search query is invalid")
	ErrMemberNotFound            = errors.New("member not found in this group")
	ErrCannotRemoveCreator       = errors.New("cannot remove group creator")
)

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
	case errors.Is(err, ErrJoinRequestNotAllowed):
		return http.StatusForbidden, "Private groups are invite only"
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
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can invite people"
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

// deleteGroupErrorResponse maps a delete-group service error to an HTTP
// status code and a user-facing message.
func deleteGroupErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can do this"
	default:
		return http.StatusInternalServerError, "Failed to delete group"
	}
}

// removeMemberErrorResponse maps a remove-member service error to an HTTP
// status code and a user-facing message.
func removeMemberErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrGroupNotFound):
		return http.StatusNotFound, "Group not found"
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can do this"
	case errors.Is(err, ErrMemberNotFound):
		return http.StatusNotFound, "Member not found in this group"
	case errors.Is(err, ErrCannotRemoveCreator):
		return http.StatusForbidden, "cannot remove group creator"
	default:
		return http.StatusInternalServerError, "Failed to remove member"
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
	case errors.Is(err, ErrNotGroupCreator):
		return http.StatusForbidden, "Only the group creator can search for people to invite"
	case errors.Is(err, ErrInvalidSearchQuery):
		return http.StatusBadRequest, "Search query must be between 1 and 100 characters"
	default:
		return http.StatusInternalServerError, "Failed to search invite candidates"
	}
}
