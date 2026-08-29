package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Hub maintains the set of active connected clients and coordinates message routing.
type Hub struct {
	mu sync.RWMutex

	// clients maps a UserID to a set of active connections (supporting multiple tabs/devices)
	clients map[int64]map[*Client]bool

	// Channels for client lifecycle
	register   chan *Client
	unregister chan *Client
}

// NewHub creates a new initialized WebSocket Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[int64]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run executes the main Hub event loop in a background goroutine
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			userClients, exists := h.clients[client.UserID]
			if !exists {
				userClients = make(map[*Client]bool)
				h.clients[client.UserID] = userClients

				// User just came online -> notify all other users
				go h.BroadcastStatus(client.UserID, true)
			}
			userClients[client] = true
			h.mu.Unlock()

			// Send current list of online users to the newly connected client
			go h.sendInitialOnlineUsers(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if userClients, exists := h.clients[client.UserID]; exists {
				if _, ok := userClients[client]; ok {
					delete(userClients, client)
					close(client.send)

					// If no more open connections for this user -> mark offline
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

// RegisterClient queues a client for registration in the Hub
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// UnregisterClient queues a client for removal from the Hub
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// SendToUser dispatches an Event to all active connection tabs of a specific user
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
				// If client buffer is blocked, close and remove to avoid memory leak
				close(client.send)
				delete(userClients, client)
			}
		}
	}
}

// SendToUsers sends an event to a list of specific user IDs (e.g. group members)
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

// Broadcast sends an event to every single connected client
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

// BroadcastStatus sends a user_online or user_offline event to all connected clients
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

// GetOnlineUserIDs returns a snapshot list of all currently active user IDs
func (h *Hub) GetOnlineUserIDs() []int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ids := make([]int64, 0, len(h.clients))
	for userID := range h.clients {
		ids = append(ids, userID)
	}
	return ids
}

// IsUserOnline checks if a user has at least one active connection
func (h *Hub) IsUserOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userClients, exists := h.clients[userID]
	return exists && len(userClients) > 0
}

// sendInitialOnlineUsers sends the current list of online users directly to a newly connected client
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
