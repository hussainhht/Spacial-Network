package notifications

import "social/internal/websocket"

const EventNotification websocket.EventType = "notification"

// NewNotificationEvent builds the "notification" websocket event. It reuses
// Notification directly as the wire payload - the same struct REST returns
// from GET /notifications - so REST and WebSocket can never drift apart.
func NewNotificationEvent(n Notification) (websocket.Event, error) {
	return websocket.NewEvent(EventNotification, n)
}
