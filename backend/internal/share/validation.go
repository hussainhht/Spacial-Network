package share

import "social/internal/validation"

// MaxNoteLength bounds the optional note a sender can attach to a share.
// Deliberately shorter than chat.MaxMessageLength so that the note plus
// the appended post link still fits inside a single chat message.
const MaxNoteLength = 1000

// ValidateNote sanitizes the optional note attached to a share. Unlike a
// comment's content it is not required - a share with no note is just the
// link.
func ValidateNote(note string) (string, error) {
	return validation.SanitizeText(note, validation.TextRules{
		Field:          "message",
		Required:       false,
		Max:            MaxNoteLength,
		AllowMultiline: true,
	})
}

// ValidateTarget checks that target names a destination this service can
// deliver to.
func ValidateTarget(target string) (string, error) {
	switch target {
	case TargetUser, TargetGroup:
		return target, nil
	default:
		return "", ErrInvalidTarget
	}
}

// ValidateTargetID checks that a recipient user or group was named.
func ValidateTargetID(targetID int64) (int64, error) {
	if targetID <= 0 {
		return 0, ErrInvalidTargetID
	}
	return targetID, nil
}
