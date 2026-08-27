package validation

import (
	"errors"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	MaxGenericInputLength = 500
)

type TextRules struct {
	Field          string
	Required       bool
	Min            int
	Max            int
	AllowMultiline bool
	ToLower        bool
}

// SanitizeText trims, optionally lowercases, and validates raw text against
// rules. Min/Max are measured in runes (not bytes) so multi-byte Unicode
// text - names, posts, comments, profile fields - isn't penalized for its
// UTF-8 encoding.
func SanitizeText(raw string, rules TextRules) (string, error) {
	value := strings.TrimSpace(raw)
	if rules.ToLower {
		value = strings.ToLower(value)
	}

	if rules.Required && value == "" {
		return "", errors.New(rules.Field + " cannot be empty")
	}
	if value == "" {
		return value, nil
	}
	if containsUnsafeControlChars(value, rules.AllowMultiline) {
		return "", errors.New(rules.Field + " contains invalid control characters")
	}

	length := utf8.RuneCountInString(value)
	if rules.Min > 0 && length < rules.Min {
		return "", errors.New(rules.Field + " must be at least " + strconv.Itoa(rules.Min) + " characters")
	}
	if rules.Max > 0 && length > rules.Max {
		return "", errors.New(rules.Field + " must be at most " + strconv.Itoa(rules.Max) + " characters")
	}

	return value, nil
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
