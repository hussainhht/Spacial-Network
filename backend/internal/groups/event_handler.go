package groups

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"social/internal/requestctx"
	"social/internal/upload"
)

const maxCreateEventRequestSize = 8 << 20

func toEventResponse(e *Event) EventResponse {
	var imagePath *string
	if e.ImagePath.Valid {
		url := "/uploads/" + e.ImagePath.String
		imagePath = &url
	}
	return EventResponse{
		ID: e.ID, GroupID: e.GroupID, CreatedBy: e.CreatedBy,
		Title:               e.Title,
		Description:         e.Description,
		EventTime:           e.EventTime.Format(time.RFC3339),
		CreatedAt:           e.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           e.UpdatedAt.Format(time.RFC3339),
		CurrentUserResponse: e.CurrentUserResponse,
		GoingCount:          e.GoingCount, NotGoingCount: e.NotGoingCount,
		ImagePath: imagePath,
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
	var imagePath string
	keepImage := false
	defer func() {
		if imagePath != "" && !keepImage && h.eventStorage != nil {
			_ = h.eventStorage.Remove(imagePath)
		}
	}()
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		r.Body = http.MaxBytesReader(w, r.Body, maxCreateEventRequestSize)
		if err := r.ParseMultipartForm(maxCreateEventRequestSize); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(CreateEventResponse{Success: false, Message: "Invalid request payload"})
			return
		}
		if r.MultipartForm != nil {
			defer r.MultipartForm.RemoveAll()
		}
		req = CreateEventRequest{Title: r.FormValue("title"), Description: r.FormValue("description"), EventTime: r.FormValue("event_time")}
		file, header, fileErr := r.FormFile("image")
		if fileErr == nil {
			defer file.Close()
			if h.eventStorage == nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(CreateEventResponse{Success: false, Message: "Unable to store event image"})
				return
			}
			imagePath, err = h.eventStorage.Save(file, header)
			if err != nil {
				status := http.StatusInternalServerError
				message := "Unable to store event image"
				if errors.Is(err, upload.ErrInvalidFileType) || errors.Is(err, upload.ErrFileTooLarge) {
					status, message = http.StatusBadRequest, "Invalid event image upload"
				}
				w.WriteHeader(status)
				json.NewEncoder(w).Encode(CreateEventResponse{Success: false, Message: message})
				return
			}
		} else if !errors.Is(fileErr, http.ErrMissingFile) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(CreateEventResponse{Success: false, Message: "Invalid event image upload"})
			return
		}
	} else if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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

	eventID, err := h.service.CreateEventWithImage(groupID, userID, title, description, eventTime, imagePath)
	if err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(CreateEventResponse{
			Success: false,
			Message: message,
		})
		return
	}
	keepImage = true
	var imageURL *string
	if imagePath != "" {
		url := "/uploads/" + imagePath
		imageURL = &url
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateEventResponse{
		Success:   true,
		Message:   "Event created successfully",
		EventID:   eventID,
		ImagePath: imageURL,
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

	event, err := h.service.GetEventDetails(groupID, eventID, userID)
	if err != nil {
		status, message := eventErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(GetEventResponse{Success: false, Message: message})
		return
	}
	eventResp := toEventResponse(event)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetEventResponse{Success: true, Message: "Response saved", Event: &eventResp})
}

func (h *Handler) GetEventResponsesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fail := func(status int, message string) {
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(ListEventResponsesResponse{Success: false, Message: message})
	}
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		fail(http.StatusUnauthorized, "Not logged in")
		return
	}
	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		fail(http.StatusBadRequest, err.Error())
		return
	}
	eventID, err := ValidateEventID(r.PathValue("eventID"))
	if err != nil {
		fail(http.StatusBadRequest, err.Error())
		return
	}
	responses, err := h.service.GetEventResponses(groupID, eventID, userID)
	if err != nil {
		status, message := eventErrorResponse(err)
		fail(status, message)
		return
	}
	json.NewEncoder(w).Encode(ListEventResponsesResponse{Success: true, Responses: responses})
}
