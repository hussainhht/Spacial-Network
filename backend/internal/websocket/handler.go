package websocket

import (
	"log"
	"net/http"

	"social/internal/requestctx"
)

type Handler struct {
	hub            *Hub
	messageHandler MessageHandler
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

func (h *Handler) SetMessageHandler(handler MessageHandler) {
	h.messageHandler = handler
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
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
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
