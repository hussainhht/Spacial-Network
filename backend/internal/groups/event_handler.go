package groups

import (
	"encoding/json"
	"net/http"
	"time"

	"social/internal/requestctx"
)

func toEventResponse(e *Event) EventResponse {
	return EventResponse{
		ID: e.ID, GroupID: e.GroupID, CreatedBy: e.CreatedBy,
		Title:               e.Title,
		Description:         e.Description,
		EventTime:           e.EventTime.Format(time.RFC3339),
		CreatedAt:           e.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           e.UpdatedAt.Format(time.RFC3339),
		CurrentUserResponse: e.CurrentUserResponse,
	}
}

func (h *Handler) CreateEventHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: "Invalid request payload",
		})
		return
	}

	title, err := ValidateEventTitle(req.Title)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	description, err := ValidateEventDescription(req.Description)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	eventTime, err := ValidateEventTime(req.EventTime)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	eventID, err := h.service.CreateEvent(groupID, userID, title, description, eventTime)
	if err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateEventResponse{
		Success: true,
		Message: "Event created successfully",
		EventID: eventID,
	})
}

func (h *Handler) GetGroupEventsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ListEventsResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ListEventsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ListEventsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	events, err := h.service.GetGroupEvents(groupID, userID)
	if err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(ListEventsResponse{
			Success: false,
			Message: message,
		})
		return
	}

	resp := make([]EventResponse, len(events))
	for i, e := range events {
		resp[i] = toEventResponse(&e)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ListEventsResponse{
		Success: true,
		Events:  resp,
	})
}

func (h *Handler) GetEventHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(GetEventResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetEventResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	eventID, err := ValidateEventID(r.PathValue("eventID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetEventResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	event, err := h.service.GetEventDetails(groupID, eventID, userID)
	if err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(GetEventResponse{
			Success: false,
			Message: message,
		})
		return
	}

	eventResp := toEventResponse(event)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetEventResponse{
		Success: true,
		Event:   &eventResp,
	})
}

func (h *Handler) RespondToEventHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	eventID, err := ValidateEventID(r.PathValue("eventID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	var req RespondToEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: "Invalid request payload",
		})
		return
	}

	response, err := ValidateEventResponseStatus(req.Response)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.RespondToEvent(groupID, eventID, userID, response); err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ActionResponse{
		Success: true,
		Message: "Response saved",
	})
}
