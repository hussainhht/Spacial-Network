package validation

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
)

const (
	MaxGenericInputLength = 500
	MaxTitleLength        = 50
	MinUsernameLength     = 3
	MaxUsernameLength     = 20
	MinPasswordLength     = 8
	MaxPasswordLength     = 20
)

var EmailPattern = regexp.MustCompile(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`)

type TextRules struct {
	Field          string
	Required       bool
	Min            int
	Max            int
	AllowMultiline bool
	ToLower        bool
}

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
	if !isASCII(value) {
		return "", errors.New(rules.Field + " must contain ASCII characters only")
	}
	if containsUnsafeControlChars(value, rules.AllowMultiline) {
		return "", errors.New(rules.Field + " contains invalid control characters")
	}
	if rules.Min > 0 && len(value) < rules.Min {
		return "", errors.New(rules.Field + " must be at least " + strconv.Itoa(rules.Min) + " characters")
	}
	if rules.Max > 0 && len(value) > rules.Max {
		return "", errors.New(rules.Field + " must be at most " + strconv.Itoa(rules.Max) + " characters")
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
