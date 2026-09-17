package auth

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"social/internal/users"
	"social/internal/validation"
)

const (
	MinPasswordLength = 8
	// MaxPasswordLength matches bcrypt's own limit: it only hashes the
	// first 72 bytes of a password, so anything past that is a no-op at
	// best and misleading at worst.
	MaxPasswordLength = 72
)

var EmailPattern = regexp.MustCompile(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`)

// ValidatePassword sanitizes and validates a password. The maximum is
// enforced in bytes, not runes, to match bcrypt's 72-byte limit.
func ValidatePassword(password string) (string, error) {
	sanitized, err := validation.SanitizeText(password, validation.TextRules{
		Field:    "password",
		Required: true,
		Min:      MinPasswordLength,
	})
	if err != nil {
		return "", err
	}
	if len(sanitized) > MaxPasswordLength {
		return "", errors.New("password must be at most " + strconv.Itoa(MaxPasswordLength) + " characters")
	}
	return sanitized, nil
}

func ValidateEmail(email string) (string, error) {
	sanitized, err := validation.SanitizeText(email, validation.TextRules{
		Field:    "email",
		Required: true,
		Max:      validation.MaxGenericInputLength,
		ToLower:  true,
	})
	if err != nil {
		return "", err
	}
	if !EmailPattern.MatchString(sanitized) {
		return "", errors.New("invalid email format")
	}
	return sanitized, nil
}

func ValidateLoginRequest(login *LoginRequest) error {
	if login == nil {
		return errors.New("invalid login payload")
	}

	var err error
	login.Username = strings.TrimSpace(login.Username)
	if strings.Contains(login.Username, "@") {
		login.Username, err = ValidateEmail(login.Username)
	} else {
		login.Username, err = users.ValidateUsername(login.Username)
	}
	if err != nil {
		return err
	}

	login.Password, err = ValidatePassword(login.Password)
	return err
}

func ValidateRegisterRequest(register *RegisterRequest) error {
	if register == nil {
		return errors.New("invalid register payload")
	}

	var err error
	register.Username, err = users.ValidateUsername(register.Username)
	if err != nil {
		return err
	}

	register.Password, err = ValidatePassword(register.Password)
	if err != nil {
		return err
	}

	register.FirstName, err = users.ValidateName("first name", register.FirstName)
	if err != nil {
		return err
	}

	register.LastName, err = users.ValidateName("last name", register.LastName)
	if err != nil {
		return err
	}

	register.Email, err = ValidateEmail(register.Email)
	if err != nil {
		return err
	}

	register.Gender, err = users.ValidateGender(register.Gender)
	if err != nil {
		return err
	}

	register.DateOfBirth, register.Age, err = users.ValidateDateOfBirth(register.DateOfBirth)
	if err != nil {
		return err
	}

	if register.Nickname != "" {
		nickname := register.Nickname
		normalized, err := users.ValidateOptionalNickname(&nickname)
		if err != nil {
			return err
		}
		register.Nickname = ""
		if normalized != nil {
			register.Nickname = *normalized
		}
	}

	if register.AboutMe != "" {
		aboutMe := register.AboutMe
		normalized, err := users.ValidateOptionalAboutMe(&aboutMe)
		if err != nil {
			return err
		}
		register.AboutMe = ""
		if normalized != nil {
			register.AboutMe = *normalized
		}
	}

	return nil
}
