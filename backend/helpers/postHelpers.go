package helpers

import (
	"errors"
	"regexp"
	"social/models"
	"strconv"
	"strings"
)

const (
	maxGenericInputLength = 500
	maxTitleLength        = 50
	minUsernameLength     = 3
	maxUsernameLength     = 20
	minPasswordLength     = 8
	maxPasswordLength     = 20
)

var emailPattern = regexp.MustCompile(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`)

func ValidateAndSanitize(input any) error {
	switch value := input.(type) {
	// case *models.Post:
	// 	return validateAndSanitizePost(value)
	// case *models.Comment:
	// 	return validateAndSanitizeComment(value)
	case *models.LoginRequest:
		return validateAndSanitizeLogin(value)
	case *models.RegisterRequest:
		return validateAndSanitizeRegister(value)
	// case *models.DirectMessage:
	// 	return validateAndSanitizeDirectMessage(value)
	default:
		return errors.New("unsupported input type")
	}
}

// func validateAndSanitizePost(post *models.Post) error {
// 	if post == nil {
// 		return errors.New("invalid post payload")
// 	}

// 	var err error
// 	post.Title, err = sanitizeText(post.Title, textRules{
// 		field:    "title",
// 		required: true,
// 		max:      maxTitleLength,
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	post.Content, err = sanitizeText(post.Content, textRules{
// 		field:          "content",
// 		required:       true,
// 		max:            maxGenericInputLength,
// 		allowMultiline: true,
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	post.Category = models.PostCategory(strings.ToLower(strings.TrimSpace(post.Category.String())))
// 	if !post.Category.IsValid() {
// 		return errors.New("invalid category: " + post.Category.String())
// 	}
// 	if post.UserID <= 0 {
// 		return errors.New("invalid user ID")
// 	}

// 	return nil
// }

// func validateAndSanitizeComment(comment *models.Comment) error {
// 	if comment == nil {
// 		return errors.New("invalid comment payload")
// 	}

// 	var err error
// 	comment.Content, err = sanitizeText(comment.Content, textRules{
// 		field:          "comment",
// 		required:       true,
// 		max:            maxGenericInputLength,
// 		allowMultiline: true,
// 	})
// 	if err != nil {
// 		return err
// 	}
// 	if comment.PostID <= 0 {
// 		return errors.New("invalid post ID")
// 	}
// 	if comment.UserID <= 0 {
// 		return errors.New("invalid user ID")
// 	}

// 	return nil
// }

func validateAndSanitizeLogin(login *models.LoginRequest) error {
	if login == nil {
		return errors.New("invalid login payload")
	}

	var err error
	login.Username = strings.TrimSpace(login.Username)
	if strings.Contains(login.Username, "@") {
		login.Username, err = sanitizeText(login.Username, textRules{
			field:    "email",
			required: true,
			max:      maxGenericInputLength,
			toLower:  true,
		})
		if err != nil {
			return err
		}
		if !emailPattern.MatchString(login.Username) {
			return errors.New("invalid email format")
		}
	} else {
		login.Username, err = sanitizeText(login.Username, textRules{
			field:    "username",
			required: true,
			min:      minUsernameLength,
			max:      maxUsernameLength,
		})
		if err != nil {
			return err
		}
	}

	login.Password, err = sanitizeText(login.Password, textRules{
		field:    "password",
		required: true,
		min:      minPasswordLength,
		max:      maxPasswordLength,
	})
	return err
}

func validateAndSanitizeRegister(register *models.RegisterRequest) error {
	if register == nil {
		return errors.New("invalid register payload")
	}

	var err error
	register.Username, err = sanitizeText(register.Username, textRules{
		field:    "username",
		required: true,
		min:      minUsernameLength,
		max:      maxUsernameLength,
	})
	if err != nil {
		return err
	}

	register.Password, err = sanitizeText(register.Password, textRules{
		field:    "password",
		required: true,
		min:      minPasswordLength,
		max:      maxPasswordLength,
	})
	if err != nil {
		return err
	}

	register.FirstName, err = sanitizeText(register.FirstName, textRules{
		field:    "first name",
		required: true,
		max:      maxGenericInputLength,
	})
	if err != nil {
		return err
	}

	register.LastName, err = sanitizeText(register.LastName, textRules{
		field:    "last name",
		required: true,
		max:      maxGenericInputLength,
	})
	if err != nil {
		return err
	}

	register.Email, err = sanitizeText(register.Email, textRules{
		field:    "email",
		required: true,
		max:      maxGenericInputLength,
		toLower:  true,
	})
	if err != nil {
		return err
	}
	if !emailPattern.MatchString(register.Email) {
		return errors.New("invalid email format")
	}

	register.Gender, err = sanitizeText(register.Gender, textRules{
		field:    "gender",
		required: true,
		max:      maxGenericInputLength,
		toLower:  true,
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

// func validateAndSanitizeDirectMessage(message *models.DirectMessage) error {
// 	if message == nil {
// 		return errors.New("invalid message payload")
// 	}

// 	var err error
// 	message.Target, err = sanitizeText(message.Target, textRules{
// 		field:    "username",
// 		required: true,
// 		min:      minUsernameLength,
// 		max:      maxUsernameLength,
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	message.Content, err = sanitizeText(message.Content, textRules{
// 		field:          "message",
// 		required:       true,
// 		max:            maxGenericInputLength,
// 		allowMultiline: true,
// 	})
// 	return err
// }

type textRules struct {
	field          string
	required       bool
	min            int
	max            int
	allowMultiline bool
	toLower        bool
}

func sanitizeText(raw string, rules textRules) (string, error) {
	value := strings.TrimSpace(raw)
	if rules.toLower {
		value = strings.ToLower(value)
	}

	if rules.required && value == "" {
		return "", errors.New(rules.field + " cannot be empty")
	}
	if value == "" {
		return value, nil
	}
	if !isASCII(value) {
		return "", errors.New(rules.field + " must contain ASCII characters only")
	}
	if containsUnsafeControlChars(value, rules.allowMultiline) {
		return "", errors.New(rules.field + " contains invalid control characters")
	}
	if rules.min > 0 && len(value) < rules.min {
		return "", errors.New(rules.field + " must be at least " + intToString(rules.min) + " characters")
	}
	if rules.max > 0 && len(value) > rules.max {
		return "", errors.New(rules.field + " must be at most " + intToString(rules.max) + " characters")
	}

	return value, nil
}

func isASCII(value string) bool {
	for _, r := range value {
		if r > 127 {
			return false
		}
	}
	return true
}

func containsUnsafeControlChars(value string, allowMultiline bool) bool {
	for _, r := range value {
		switch {
		case r == '\n' || r == '\r' || r == '\t':
			if !allowMultiline {
				return true
			}
		case r < 32 || r == 127:
			return true
		}
	}
	return false
}

func intToString(value int) string {
	return strconv.Itoa(value)
}
