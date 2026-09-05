package notifications

import (
	"fmt"

	"social/internal/websocket"
)

type NotificationSender interface {
	SendToUser(userID int, event any) error
}


type HubSender struct {
	hub *websocket.Hub
}

func NewHubSender(hub *websocket.Hub) *HubSender {
	return &HubSender{hub: hub}
}


func (s *HubSender) SendToUser(userID int, event any) error {
	wsEvent, ok := event.(websocket.Event)
	if !ok {
		return fmt.Errorf("notifications: HubSender received unsupported event type %T", event)
	}
	s.hub.SendToUser(int64(userID), wsEvent)
	return nil
}
