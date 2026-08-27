package auth

import "errors"

var (
	ErrTypeNotCorrect     = errors.New("Invalid Type")
	ErrNotFound           = errors.New("Not Found")
	ErrInvalidPassword    = errors.New("Invalid Password")
	ErrInvalidCredentials = errors.New("Invalid Credentials")
)
