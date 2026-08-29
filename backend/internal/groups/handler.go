package groups

import (
	"encoding/json"
	"net/http"

	"social/internal/auth"
)

type CreateGroupRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type CreateGroupResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	GroupID int64  `json:"group_id,omitempty"`
}

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) CreateGroupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Invalid request payload",
		})
		return
	}

	title, err := ValidateTitle(req.Title)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	description, err := ValidateDescription(req.Description)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	groupID, err := h.service.CreateGroup(userID, title, description)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Failed to create group",
		})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateGroupResponse{
		Success: true,
		Message: "Group created successfully",
		GroupID: groupID,
	})
}
