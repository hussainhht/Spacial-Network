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
