package websocket

import (
	"log"
	"net/http"

	"social/internal/auth"
)

// Handler manages the HTTP-to-WebSocket upgrade endpoint
type Handler struct {
	hub            *Hub
	messageHandler MessageHandler
}

// NewHandler creates a new WebSocket endpoint Handler
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

// SetMessageHandler assigns the callback for processing incoming messages from clients
func (h *Handler) SetMessageHandler(handler MessageHandler) {
	h.messageHandler = handler
}

// ServeWS upgrades the incoming HTTP request to a WebSocket connection
// The endpoint must be protected by SessionMiddleware so auth.UserIDKey is present.
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value(auth.UserIDKey)
	if userIDVal == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := userIDVal.(int)
	if !ok || userID <= 0 {
		http.Error(w, "Unauthorized: invalid user", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error for user %d: %v", userID, err)
		return
	}

	client := NewClient(h.hub, conn, int64(userID), h.messageHandler)
	h.hub.RegisterClient(client)

	// Start concurrent read and write loops
	go client.WritePump()
	go client.ReadPump()
}
