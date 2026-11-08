package websocket

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"social/internal/config"
	"social/internal/requestctx"
)

type Handler struct {
	upgrader       websocket.Upgrader
	hub            *Hub
	messageHandler MessageHandler
}

func NewHandler(hub *Hub, configs ...config.Config) *Handler {
	cfg := config.Load()
	if len(configs) > 0 {
		cfg = configs[0]
	}
	return &Handler{
		hub:      hub,
		upgrader: newUpgrader(cfg),
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

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error for user %d: %v", userID, err)
		return
	}

	client := NewClient(h.hub, conn, int64(userID), h.messageHandler)
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
