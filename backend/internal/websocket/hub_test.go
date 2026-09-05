package websocket

import (
	"sync"
	"testing"
)

func TestHubRegisterUnregister(t *testing.T) {
	hub := NewHub()

	client1 := NewClient(hub, nil, 1, nil)
	client2 := NewClient(hub, nil, 1, nil)
	client3 := NewClient(hub, nil, 2, nil)

	// Register client 1
	hub.Register(client1)
	if !hub.IsUserOnline(1) {
		t.Errorf("expected user 1 to be online")
	}
	if hub.IsUserOnline(2) {
		t.Errorf("expected user 2 to be offline")
	}

	// Register client 2 (same user, multi-tab)
	hub.Register(client2)
	if !hub.IsUserOnline(1) {
		t.Errorf("expected user 1 to still be online")
	}

	// Register client 3 (user 2)
	hub.Register(client3)
	if !hub.IsUserOnline(2) {
		t.Errorf("expected user 2 to be online")
	}

	onlineIDs := hub.GetOnlineUserIDs()
	if len(onlineIDs) != 2 {
		t.Errorf("expected 2 online users, got %d", len(onlineIDs))
	}

	// Unregister client 1 (user 1 still has client 2 open)
	hub.Unregister(client1)
	if !hub.IsUserOnline(1) {
		t.Errorf("expected user 1 to still be online with client 2")
	}

	// Unregister client 2 (user 1 now offline)
	hub.Unregister(client2)
	if hub.IsUserOnline(1) {
		t.Errorf("expected user 1 to be offline")
	}

	// Unregister client 3
	hub.Unregister(client3)
	if hub.IsUserOnline(2) {
		t.Errorf("expected user 2 to be offline")
	}

	if len(hub.GetOnlineUserIDs()) != 0 {
		t.Errorf("expected 0 online users, got %d", len(hub.GetOnlineUserIDs()))
	}
}

func TestHubConcurrentSend(t *testing.T) {
	hub := NewHub()

	clients := make([]*Client, 50)
	for i := 0; i < 50; i++ {
		clients[i] = NewClient(hub, nil, int64(i+1), nil)
		hub.Register(clients[i])
	}

	event, err := NewEvent(EventUserOnline, UserStatusPayload{UserID: 99, IsOnline: true})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	var wg sync.WaitGroup
	// Run 100 concurrent goroutines sending and broadcasting
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			if idx%2 == 0 {
				hub.Broadcast(event)
			} else {
				target := int64((idx % 50) + 1)
				hub.SendToUser(target, event)
			}
		}(i)
	}

	wg.Wait()

	// Clean up
	for _, c := range clients {
		hub.Unregister(c)
	}
}
