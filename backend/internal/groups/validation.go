package groups

import (
	"errors"
	"strconv"

	"social/internal/validation"
)

const (
	MinTitleLength = 3
	MaxTitleLength = 100

	DefaultListLimit = 20
	MaxListLimit     = 100
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

// ValidatePagination parses and validates the limit/offset query params for
// listing groups. Blank values fall back to defaults.
func ValidatePagination(limitParam, offsetParam string) (limit int, offset int, err error) {
	limit = DefaultListLimit
	if limitParam != "" {
		limit, err = strconv.Atoi(limitParam)
		if err != nil || limit <= 0 {
			return 0, 0, errors.New("limit must be a positive integer")
		}
		if limit > MaxListLimit {
			return 0, 0, errors.New("limit must be at most " + strconv.Itoa(MaxListLimit))
		}
	}

	offset = 0
	if offsetParam != "" {
		offset, err = strconv.Atoi(offsetParam)
		if err != nil || offset < 0 {
			return 0, 0, errors.New("offset must be zero or a positive integer")
		}
	}

	return limit, offset, nil
}
