package groups

import (
	"errors"
	"strconv"
	"strings"

	"social/internal/validation"
)

var groupImageTemplates = map[string]string{
	"earth":  "/image/templets/earth.png",
	"mars":   "/image/templets/mars.png",
	"moon":   "/image/templets/moon.png",
	"saturn": "/image/templets/saturn.png",
}

const (
	MinTitleLength = 3
	MaxTitleLength = 100

	DefaultListLimit = 20
	MaxListLimit     = 100

	MaxInviteSearchQueryLength  = 100
	DefaultInviteCandidateLimit = 10
	MaxInviteCandidateLimit     = 25

	MaxGroupSearchQueryLength = 100
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

// ValidatePrivacy accepts the two supported membership modes. An omitted
// value defaults to public because groups predating privacy were discoverable
// and used creator-approved join requests.
func ValidatePrivacy(privacy string) (GroupPrivacy, error) {
	switch GroupPrivacy(privacy) {
	case "":
		return GroupPrivacyPublic, nil
	case GroupPrivacyPublic, GroupPrivacyPrivate:
		return GroupPrivacy(privacy), nil
	default:
		return "", errors.New("privacy must be public or private")
	}
}

// ValidateGroupImageTemplateID maps a client-provided identifier to one of
// the static image URLs shipped with the frontend. Client-provided paths are
// never stored directly.
func ValidateGroupImageTemplateID(raw string) (string, error) {
	id := strings.TrimSpace(raw)
	if id == "" {
		return "", nil
	}

	path, ok := groupImageTemplates[id]
	if !ok {
		return "", errors.New("image_template_id must be an approved group photo template")
	}
	return path, nil
}

func isGroupImageTemplate(value string) bool {
	for _, path := range groupImageTemplates {
		if value == path {
			return true
		}
	}
	return false
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

// ValidateGroupID parses and validates a group ID taken from a URL path.
func ValidateGroupID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("group id must be a positive integer")
	}
	return id, nil
}

// ValidateJoinRequestID parses and validates a group join request ID taken
// from a URL path.
func ValidateJoinRequestID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("join request id must be a positive integer")
	}
	return id, nil
}

// ValidateInvitationID parses and validates a group invitation ID taken
// from a URL path.
func ValidateInvitationID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("invitation id must be a positive integer")
	}
	return id, nil
}

// ValidateMemberID parses and validates a group member's user ID taken
// from a URL path.
func ValidateMemberID(idParam string) (int, error) {
	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
		return 0, errors.New("member id must be a positive integer")
	}
	return id, nil
}

// ValidateInvitedUserID validates the invited user's ID from a group
// invitation request body.
func ValidateInvitedUserID(id int) (int, error) {
	if id <= 0 {
		return 0, errors.New("invited_user_id must be a positive integer")
	}
	return id, nil
}

// ValidateInviteSearchQuery sanitizes the `q` query param used to search for
// invite candidates.
func ValidateInviteSearchQuery(query string) (string, error) {
	return validation.SanitizeText(query, validation.TextRules{
		Field:    "search query",
		Required: true,
		Max:      MaxInviteSearchQueryLength,
	})
}

// ValidateGroupSearchQuery sanitizes the optional `search` query param used
// to filter the groups list by title/description. Blank is valid and means
// "no filter".
func ValidateGroupSearchQuery(query string) (string, error) {
	return validation.SanitizeText(query, validation.TextRules{
		Field: "search",
		Max:   MaxGroupSearchQueryLength,
	})
}
