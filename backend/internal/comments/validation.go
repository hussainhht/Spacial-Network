package comments

import "social/internal/validation"

const MaxContentLength = 2000

func ValidateContent(content string) (string, error) {
	return validation.SanitizeText(content, validation.TextRules{
		Field:          "content",
		Required:       true,
		Max:            MaxContentLength,
		AllowMultiline: true,
	})
}
