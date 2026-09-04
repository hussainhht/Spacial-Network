package groups

import "errors"

// ErrGroupNotFound is returned when a group with the given ID does not exist.
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
