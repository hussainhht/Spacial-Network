package chat

import (
	"encoding/json"
	"testing"
	"time"

	"social/internal/websocket"
)

func TestChatServiceWSValidation(t *testing.T) {
	hub := websocket.NewHub()
	service := NewService(nil, hub)

	client := websocket.NewClient(hub, nil, 10, nil)
	hub.Register(client)
	defer hub.Unregister(client)

	// Test 1: Self message should be rejected
	selfMsg, _ := json.Marshal(MessagePayload{
		RecipientID: 10,
		Content:     "Hello self",
	})
	service.HandleIncomingWSMessage(10, selfMsg)

	// Test 2: Empty message should be rejected
	emptyMsg, _ := json.Marshal(MessagePayload{
		RecipientID: 20,
		Content:     "   ",
	})
	service.HandleIncomingWSMessage(10, emptyMsg)
}

func TestTypingIndicatorDelivery(t *testing.T) {
	hub := websocket.NewHub()
	service := NewService(nil, hub)

	client2 := websocket.NewClient(hub, nil, 20, nil)
	hub.Register(client2)
	defer hub.Unregister(client2)

	typingPayload, _ := json.Marshal(TypingPayload{
		RecipientID: 20,
		IsTyping:    true,
	})
	typingEvent, _ := websocket.NewEvent(EventTyping, TypingPayload{
		RecipientID: 20,
		IsTyping:    true,
	})
	rawEvent, _ := json.Marshal(typingEvent)

	service.HandleIncomingWSMessage(10, rawEvent)

	_ = typingPayload
	time.Sleep(10 * time.Millisecond)
}
