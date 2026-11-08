package websocket

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"social/internal/config"
	"social/internal/requestctx"
)

type Handler struct {
	upgrader        websocket.Upgrader
	hub             *Hub
	messageHandler  MessageHandler
	cookieName      string
	validateSession func(string) (int, error)
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

// SetSessionValidator binds live sockets to the same database session as HTTP.
// Configure before serving requests. Validation never extends session expiry.
func (h *Handler) SetSessionValidator(cookieName string, validate func(string) (int, error)) {
	h.cookieName = cookieName
	h.validateSession = validate
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok || userID <= 0 {
		http.Error(w, "Unauthorized: invalid user", http.StatusUnauthorized)
		return
	}

	var sessionValid func() bool
	if h.validateSession != nil {
		cookie, err := r.Cookie(h.cookieName)
		if err != nil {
			http.Error(w, "Unauthorized: missing session", http.StatusUnauthorized)
			return
		}
		sessionValid = func() bool {
			id, err := h.validateSession(cookie.Value)
			return err == nil && id == userID
		}
		if !sessionValid() {
			http.Error(w, "Unauthorized: invalid session", http.StatusUnauthorized)
			return
		}
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error for user %d: %v", userID, err)
		return
	}

	client := NewClient(h.hub, conn, int64(userID), h.messageHandler)
	client.sessionValid = sessionValid
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
