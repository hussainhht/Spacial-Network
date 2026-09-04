package notifications

import (
	"errors"
	"strconv"
)

const (
	DefaultListLimit = 20
	MaxListLimit     = 100
)

// ValidatePagination parses and validates the limit/offset query params for
// listing notifications. Blank values fall back to defaults.
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

// ValidateNotificationID parses and validates a notification ID taken from a
// URL path.
func ValidateNotificationID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("notification id must be a positive integer")
	}
	return id, nil
}
