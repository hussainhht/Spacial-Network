package users

import (
	"errors"

	"social/internal/validation"
)

const (
	MinUsernameLength = 3
	MaxUsernameLength = 20
)

func ValidateUsername(username string) (string, error) {
	return validation.SanitizeText(username, validation.TextRules{
		Field:    "username",
		Required: true,
		Min:      MinUsernameLength,
		Max:      MaxUsernameLength,
	})
}

// ValidateName validates a free-text profile field such as a first or last
// name. field is used in the error message (e.g. "first name").
func ValidateName(field, name string) (string, error) {
	return validation.SanitizeText(name, validation.TextRules{
		Field:    field,
		Required: true,
		Max:      validation.MaxGenericInputLength,
	})
}

// ValidateAboutMe validates an optional free-text "about me" profile field.
func ValidateAboutMe(aboutMe string) (string, error) {
	return validation.SanitizeText(aboutMe, validation.TextRules{
		Field:          "about me",
		Required:       false,
		Max:            validation.MaxGenericInputLength,
		AllowMultiline: true,
	})
}

// ValidateNickname validates an optional single-line nickname profile field.
func ValidateNickname(nickname string) (string, error) {
	return validation.SanitizeText(nickname, validation.TextRules{
		Field:    "nickname",
		Required: false,
		Max:      validation.MaxGenericInputLength,
	})
}

func ValidateGender(gender string) (string, error) {
	sanitized, err := validation.SanitizeText(gender, validation.TextRules{
		Field:    "gender",
		Required: true,
		Max:      validation.MaxGenericInputLength,
		ToLower:  true,
	})
	if err != nil {
		return "", err
	}
	if sanitized != "male" && sanitized != "female" {
		return "", errors.New("invalid gender selection")
	}
	return sanitized, nil
}

func ValidateAge(age int) error {
	if age <= 0 {
		return errors.New("age must be above 0")
	}
	if age > 120 {
		return errors.New("age must be 120 or below")
	}
	return nil
}
