package users

import "errors"

// ErrInvalidCredentials is returned when a username/email and password
// combination does not match a stored user.
var ErrInvalidCredentials = errors.New("invalid credentials")
