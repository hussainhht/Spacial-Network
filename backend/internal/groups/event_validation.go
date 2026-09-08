package groups

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"social/internal/validation"
)

// ValidateEventTitle sanitizes and requires the event title.
func ValidateEventTitle(title string) (string, error) {
	return validation.SanitizeText(title, validation.TextRules{
		Field:    "title",
		Required: true,
		Max:      validation.MaxGenericInputLength,
	})
}

// ValidateEventDescription sanitizes the event description. It is optional,
// matching how group descriptions are validated (see ValidateDescription).
func ValidateEventDescription(description string) (string, error) {
	return validation.SanitizeText(description, validation.TextRules{
		Field:          "description",
		Max:            validation.MaxGenericInputLength,
		AllowMultiline: true,
	})
}

// ValidateEventTime parses the event time, requiring RFC3339 (the format
// already used elsewhere in the API for timestamps).
func ValidateEventTime(raw string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, errors.New("event_time must be a valid RFC3339 date/time")
	}
	return t, nil
}

// ValidateEventID parses and validates an event ID taken from a URL path.
func ValidateEventID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("event id must be a positive integer")
	}
	return id, nil
}

// ValidateEventResponseStatus validates the response value sent when a user
// responds to an event. Only "going" and "not_going" are supported.
func ValidateEventResponseStatus(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value != EventResponseGoing && value != EventResponseNotGoing {
		return "", errors.New("response must be 'going' or 'not_going'")
	}
	return value, nil
}
