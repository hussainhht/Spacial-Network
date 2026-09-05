package notifications

import "errors"

var (
	ErrNotificationNotFound = errors.New("notification not found")

	ErrInvalidNotificationType = errors.New("invalid notification type")
)
