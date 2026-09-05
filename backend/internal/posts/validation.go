package posts

import "social/internal/validation"

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

func ValidateNewPostRequest(req *NewPostRequest) error {
	var err error

	req.Title, err = ValidateTitle(req.Title)
	if err != nil {
		return err
	}

	req.Content, err = ValidateContent(req.Content)
	return err
}

func ValidateEditPostRequest(req *EditPostRequest) error {
	var err error

	req.Title, err = ValidateTitle(req.Title)
	if err != nil {
		return err
	}

	req.Content, err = ValidateContent(req.Content)
	return err
}
