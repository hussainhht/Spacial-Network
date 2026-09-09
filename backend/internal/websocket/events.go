package websocket

import "encoding/json"

type EventType string

const (
	EventUserOnline  EventType = "user_online"
	EventUserOffline EventType = "user_offline"
	EventOnlineUsers EventType = "online_users"
	EventError       EventType = "error"
)
type Event struct {
	Type    EventType       `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type UserStatusPayload struct {
	UserID   int64 `json:"user_id"`
	IsOnline bool  `json:"is_online"`
}

type OnlineUsersPayload struct {
	UserIDs []int64 `json:"user_ids"`
}
type ErrorPayload struct {
	Message string `json:"message"`
}

func NewEvent(eventType EventType, payload any) (Event, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Event{}, err
	}
	return Event{
		Type:    eventType,
		Payload: raw,
	}, nil
}
