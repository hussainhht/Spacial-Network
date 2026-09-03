package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[int64]map[*Client]bool),
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	userClients, exists := h.clients[client.UserID]
	if !exists {
		userClients = make(map[*Client]bool)
		h.clients[client.UserID] = userClients
	}
	userClients[client] = true
	isFirstConnection := len(userClients) == 1
	h.mu.Unlock()

	if isFirstConnection {
		go h.BroadcastStatus(client.UserID, true)
	}

	go h.sendInitialOnlineUsers(client)
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	userClients, exists := h.clients[client.UserID]
	if !exists {
		h.mu.Unlock()
		client.Close()
		return
	}

	delete(userClients, client)
	isLastConnection := len(userClients) == 0
	if isLastConnection {
		delete(h.clients, client.UserID)
	}
	h.mu.Unlock()

	client.Close()

	if isLastConnection {
		go h.BroadcastStatus(client.UserID, false)
	}
}

func (h *Hub) SendToUser(userID int64, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws hub marshal error: %v", err)
		return
	}

	h.mu.RLock()
	var targets []*Client
	if userClients, exists := h.clients[userID]; exists {
		targets = make([]*Client, 0, len(userClients))
		for client := range userClients {
			targets = append(targets, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range targets {
		if !client.Send(data) {
			go h.Unregister(client)
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
	var targets []*Client
	for _, userID := range userIDs {
		if userClients, exists := h.clients[userID]; exists {
			for client := range userClients {
				targets = append(targets, client)
			}
		}
	}
	h.mu.RUnlock()

	for _, client := range targets {
		if !client.Send(data) {
			go h.Unregister(client)
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
	var targets []*Client
	for _, userClients := range h.clients {
		for client := range userClients {
			targets = append(targets, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range targets {
		if !client.Send(data) {
			go h.Unregister(client)
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

	client.Send(data)
}
