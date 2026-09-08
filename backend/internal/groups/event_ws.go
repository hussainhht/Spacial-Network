package groups

import (
	"log"

	"social/internal/websocket"
)

// EventGroupEventResponseUpdated is broadcast to every current member of a
// group whenever someone's response ("going"/"not_going") to one of its
// events changes, so connected clients stay in sync without polling. This is
// distinct from the generic "notification" event (internal/notifications) -
// it is ephemeral realtime sync for one Event card, not a persisted,
// per-user notification, and it must not be treated as one.
const EventGroupEventResponseUpdated websocket.EventType = "group_event_response_updated"

// EventResponseUpdatedPayload carries just enough information for a
// connected client to update one event's response state.
type EventResponseUpdatedPayload struct {
	GroupID  int    `json:"group_id"`
	EventID  int    `json:"event_id"`
	UserID   int    `json:"user_id"`
	Response string `json:"response"`
}

// broadcastEventResponseUpdate tells every current member of groupID that
// userID's response to eventID changed. It must only be called after the
// response has already been persisted successfully - a failed or partial
// broadcast here must never be able to undo that persisted state.
func (s *Service) broadcastEventResponseUpdate(groupID, eventID, userID int, response string) {
	if s.hub == nil {
		return
	}

	members, err := s.repo.GetGroupMembers(groupID)
	if err != nil {
		log.Printf("groups: failed to load members to broadcast event %d response: %v", eventID, err)
		return
	}

	event, err := websocket.NewEvent(EventGroupEventResponseUpdated, EventResponseUpdatedPayload{
		GroupID:  groupID,
		EventID:  eventID,
		UserID:   userID,
		Response: response,
	})
	if err != nil {
		log.Printf("groups: failed to build event response update event: %v", err)
		return
	}

	for _, m := range members {
		s.hub.SendToUser(int64(m.UserID), event)
	}
}
