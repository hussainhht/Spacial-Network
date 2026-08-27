package websocket

import "encoding/json"

type EventType string

const (
	EventUserOnline  EventType = "user_online"
	EventUserOffline EventType = "user_offline"
	EventOnlineUsers EventType = "online_users"

	EventPrivateMessage EventType = "private_message"
	EventTyping         EventType = "typing"

	EventNotification  EventType = "notification"
	EventFollowRequest EventType = "follow_request"
	EventGroupInvite   EventType = "group_invite"
)

type Event struct {
	Type    EventType       `json:"type"`
	Payload json.RawMessage `json:"payload"`
}
