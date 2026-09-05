package websocket

import (
	"encoding/json"
	"log"
)

type EventHandler func(senderID int64, payload json.RawMessage)

type Router struct {
	handlers map[EventType]EventHandler
}

func NewRouter() *Router {
	return &Router{handlers: make(map[EventType]EventHandler)}
}

func (r *Router) Register(eventType EventType, handler EventHandler) {
	r.handlers[eventType] = handler
}

func (r *Router) Dispatch(senderID int64, raw []byte) {
	var event Event
	if err := json.Unmarshal(raw, &event); err != nil {
		log.Printf("ws router: unmarshal error from user %d: %v", senderID, err)
		return
	}

	handler, ok := r.handlers[event.Type]
	if !ok {
		return
	}

	handler(senderID, event.Payload)
}
