package posts

import (
	"errors"

	"social/internal/validation"
)

const (
	MaxTitleLength   = 200
	MaxContentLength = 10000
)

func ValidateTitle(title string) (string, error) {
	return validation.SanitizeText(title, validation.TextRules{
		Field:    "title",
		Required: true,
		Max:      MaxTitleLength,
	})
}

func ValidateContent(content string) (string, error) {
	return validation.SanitizeText(content, validation.TextRules{
		Field:          "content",
		Required:       true,
		Max:            MaxContentLength,
		AllowMultiline: true,
	})
}

func ValidateVisibility(visibility string) error {
	switch visibility {
	case VisibilityPublic, VisibilityFollowers, VisibilityCustom:
		return nil
	default:
		return errors.New("visibility must be one of: public, followers, custom")
	}
}

func ValidateNewPostRequest(req *NewPostRequest) error {
	var err error

	req.Title, err = ValidateTitle(req.Title)
	if err != nil {
		return err
	}

	req.Content, err = ValidateContent(req.Content)
	if err != nil {
		return err
	}

	return ValidateVisibility(req.Visibility)
}

func ValidateEditPostRequest(req *EditPostRequest) error {
	var err error

	req.Title, err = ValidateTitle(req.Title)
	if err != nil {
		return err
	}

	req.Content, err = ValidateContent(req.Content)
	if err != nil {
		return err
	}

	return ValidateVisibility(req.Visibility)
}
