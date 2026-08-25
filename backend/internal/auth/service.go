package auth

import (
	"errors"
	"strings"

	"social/internal/users"
	"social/pkg/session"
	"social/pkg/validation"
)

// Login verifies credentials and issues a new session token for the user.
func Login(identifier, password string) (int, string, error) {
	userID, err := users.CheckCredentials(identifier, password)
	if err != nil {
		return 0, "", err
	}

	token, err := session.GenerateSessionToken()
	if err != nil {
		return 0, "", err
	}

	if err := CreateSession(userID, token); err != nil {
		return 0, "", err
	}

	return userID, token, nil
}

// Logout revokes the given session token.
func Logout(token string) error {
	return RevokeSession(token)
}

func ValidateLoginRequest(login *LoginRequest) error {
	if login == nil {
		return errors.New("invalid login payload")
	}

	var err error
	login.Username = strings.TrimSpace(login.Username)
	if strings.Contains(login.Username, "@") {
		login.Username, err = validation.SanitizeText(login.Username, validation.TextRules{
			Field:    "email",
			Required: true,
			Max:      validation.MaxGenericInputLength,
			ToLower:  true,
		})
		if err != nil {
			return err
		}
		if !validation.EmailPattern.MatchString(login.Username) {
			return errors.New("invalid email format")
		}
	} else {
		login.Username, err = validation.SanitizeText(login.Username, validation.TextRules{
			Field:    "username",
			Required: true,
			Min:      validation.MinUsernameLength,
			Max:      validation.MaxUsernameLength,
		})
		if err != nil {
			return err
		}
	}

	login.Password, err = validation.SanitizeText(login.Password, validation.TextRules{
		Field:    "password",
		Required: true,
		Min:      validation.MinPasswordLength,
		Max:      validation.MaxPasswordLength,
	})
	return err
}

func ValidateRegisterRequest(register *RegisterRequest) error {
	if register == nil {
		return errors.New("invalid register payload")
	}

	var err error
	register.Username, err = validation.SanitizeText(register.Username, validation.TextRules{
		Field:    "username",
		Required: true,
		Min:      validation.MinUsernameLength,
		Max:      validation.MaxUsernameLength,
	})
	if err != nil {
		return err
	}

	register.Password, err = validation.SanitizeText(register.Password, validation.TextRules{
		Field:    "password",
		Required: true,
		Min:      validation.MinPasswordLength,
		Max:      validation.MaxPasswordLength,
	})
	if err != nil {
		return err
	}

	register.FirstName, err = validation.SanitizeText(register.FirstName, validation.TextRules{
		Field:    "first name",
		Required: true,
		Max:      validation.MaxGenericInputLength,
	})
	if err != nil {
		return err
	}

	register.LastName, err = validation.SanitizeText(register.LastName, validation.TextRules{
		Field:    "last name",
		Required: true,
		Max:      validation.MaxGenericInputLength,
	})
	if err != nil {
		return err
	}

	register.Email, err = validation.SanitizeText(register.Email, validation.TextRules{
		Field:    "email",
		Required: true,
		Max:      validation.MaxGenericInputLength,
		ToLower:  true,
	})
	if err != nil {
		return err
	}
	if !validation.EmailPattern.MatchString(register.Email) {
		return errors.New("invalid email format")
	}

	register.Gender, err = validation.SanitizeText(register.Gender, validation.TextRules{
		Field:    "gender",
		Required: true,
		Max:      validation.MaxGenericInputLength,
		ToLower:  true,
	})
	if err != nil {
		return err
	}
	if register.Gender != "male" && register.Gender != "female" {
		return errors.New("invalid gender selection")
	}

	if register.Age <= 0 {
		return errors.New("age must be above 0")
	}
	if register.Age > 120 {
		return errors.New("age must be 120 or below")
	}

	return nil
}
