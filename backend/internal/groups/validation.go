package groups

import "social/internal/validation"

const (
	MinTitleLength = 3
	MaxTitleLength = 100
)

func ValidateTitle(title string) (string, error) {
	return validation.SanitizeText(title, validation.TextRules{
		Field:    "title",
		Required: true,
		Min:      MinTitleLength,
		Max:      MaxTitleLength,
	})
}

// ValidateDescription sanitizes the group description. It is optional, so
// an empty value is left as-is rather than rejected.
func ValidateDescription(description string) (string, error) {
	return validation.SanitizeText(description, validation.TextRules{
		Field:          "description",
		Max:            validation.MaxGenericInputLength,
		AllowMultiline: true,
	})
}
