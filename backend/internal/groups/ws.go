package groups

import (
	"encoding/json"
	"log"

	"social/internal/websocket"
)

const (
	EventInviteUserSearch        websocket.EventType = "invite_user_search"
	EventInviteUserSearchResults websocket.EventType = "invite_user_search_results"
)

type InviteUserSearchPayload struct {
	RequestID string `json:"request_id"`
	GroupID   int    `json:"group_id"`
	Query     string `json:"query"`
	Limit     int    `json:"limit,omitempty"`
}

type InviteUserSearchResultsPayload struct {
	RequestID string                    `json:"request_id"`
	GroupID   int                       `json:"group_id"`
	Users     []InviteCandidateResponse `json:"users"`
}

type InviteSearchWSHandler struct {
	service *Service
	hub     *websocket.Hub
}

func NewInviteSearchWSHandler(service *Service, hub *websocket.Hub) *InviteSearchWSHandler {
	return &InviteSearchWSHandler{service: service, hub: hub}
}

func (h *InviteSearchWSHandler) HandleInviteUserSearch(senderID int64, rawPayload json.RawMessage) {
	var req InviteUserSearchPayload
	if err := json.Unmarshal(rawPayload, &req); err != nil {
		h.sendError(senderID, "Invalid search payload format")
		return
	}

	candidates, err := h.service.SearchInviteCandidates(req.GroupID, int(senderID), req.Query, req.Limit)
	if err != nil {
		_, message := inviteCandidateErrorResponse(err)
		h.sendError(senderID, message)
		return
	}

	resp := make([]InviteCandidateResponse, len(candidates))
	for i, c := range candidates {
		resp[i] = toInviteCandidateResponse(c)
	}

	outEvent, err := websocket.NewEvent(EventInviteUserSearchResults, InviteUserSearchResultsPayload{
		RequestID: req.RequestID,
		GroupID:   req.GroupID,
		Users:     resp,
	})
	if err != nil {
		log.Printf("groups ws: failed to build search results event: %v", err)
		return
	}

	h.hub.SendToUser(senderID, outEvent)
}

func (h *InviteSearchWSHandler) sendError(userID int64, message string) {
	event, err := websocket.NewEvent(websocket.EventError, websocket.ErrorPayload{
		Message: message,
	})
	if err != nil {
		return
	}
	h.hub.SendToUser(userID, event)
}
