package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

type Hub struct {
	mu sync.RWMutex
	clients map[int64]map[*Client]bool

	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[int64]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			userClients, exists := h.clients[client.UserID]
			if !exists {
				userClients = make(map[*Client]bool)
				h.clients[client.UserID] = userClients

				go h.BroadcastStatus(client.UserID, true)
			}
			userClients[client] = true
			h.mu.Unlock()

			go h.sendInitialOnlineUsers(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if userClients, exists := h.clients[client.UserID]; exists {
				if _, ok := userClients[client]; ok {
					delete(userClients, client)
					close(client.send)

					if len(userClients) == 0 {
						delete(h.clients, client.UserID)
						go h.BroadcastStatus(client.UserID, false)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}
func (h *Hub) SendToUser(userID int64, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws hub marshal error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if userClients, exists := h.clients[userID]; exists {
		for client := range userClients {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(userClients, client)
			}
		}
	}
}

func (h *Hub) SendToUsers(userIDs []int64, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws hub marshal error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, userID := range userIDs {
		if userClients, exists := h.clients[userID]; exists {
			for client := range userClients {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(userClients, client)
				}
			}
		}
	}
}

func (h *Hub) Broadcast(event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws hub marshal error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, userClients := range h.clients {
		for client := range userClients {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(userClients, client)
			}
		}
	}
}

func (h *Hub) BroadcastStatus(userID int64, isOnline bool) {
	eventType := EventUserOnline
	if !isOnline {
		eventType = EventUserOffline
	}

	event, err := NewEvent(eventType, UserStatusPayload{
		UserID:   userID,
		IsOnline: isOnline,
	})
	if err != nil {
		return
	}

	h.Broadcast(event)
}

func (h *Hub) GetOnlineUserIDs() []int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ids := make([]int64, 0, len(h.clients))
	for userID := range h.clients {
		ids = append(ids, userID)
	}
	return ids
}

func (h *Hub) IsUserOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userClients, exists := h.clients[userID]
	return exists && len(userClients) > 0
}

func (h *Hub) sendInitialOnlineUsers(client *Client) {
	ids := h.GetOnlineUserIDs()

	event, err := NewEvent(EventOnlineUsers, OnlineUsersPayload{
		UserIDs: ids,
	})
	if err != nil {
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	select {
	case client.send <- data:
	default:
	}
}
