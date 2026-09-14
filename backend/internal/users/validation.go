package users

import (
	"errors"
	"strings"
	"time"

	"social/internal/validation"
)

const (
	MinUsernameLength = 3
	MaxUsernameLength = 20
	MaxNicknameLength = 50
	MaxAboutMeLength  = 500
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

func ValidateUpdateProfileDetailsRequest(req *UpdateProfileDetailsRequest) error {
	firstName, err := ValidateName("first name", req.FirstName)
	if err != nil {
		return err
	}

	lastName, err := ValidateName("last name", req.LastName)
	if err != nil {
		return err
	}

	nickname, err := validateOptionalProfileText("nickname", req.Nickname, MaxNicknameLength, false)
	if err != nil {
		return err
	}

	aboutMe, err := validateOptionalProfileText("about me", req.AboutMe, MaxAboutMeLength, true)
	if err != nil {
		return err
	}

	dateOfBirth, err := validateOptionalDateOfBirth(req.DateOfBirth)
	if err != nil {
		return err
	}

	req.FirstName = firstName
	req.LastName = lastName
	req.Nickname = nickname
	req.AboutMe = aboutMe
	req.DateOfBirth = dateOfBirth

	return nil
}

func validateOptionalProfileText(field string, value *string, max int, allowMultiline bool) (*string, error) {
	if value == nil {
		return nil, nil
	}

	sanitized, err := validation.SanitizeText(*value, validation.TextRules{
		Field:          field,
		Required:       false,
		Max:            max,
		AllowMultiline: allowMultiline,
	})
	if err != nil {
		return nil, err
	}
	if sanitized == "" {
		return nil, nil
	}

	return &sanitized, nil
}

func validateOptionalDateOfBirth(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}

	dateText := strings.TrimSpace(*value)
	if dateText == "" {
		return nil, nil
	}

	dateOfBirth, err := time.Parse("2006-01-02", dateText)
	if err != nil {
		return nil, errors.New("date of birth must use YYYY-MM-DD format")
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if dateOfBirth.After(today) {
		return nil, errors.New("date of birth cannot be in the future")
	}

	formatted := dateOfBirth.Format("2006-01-02")
	return &formatted, nil
}
