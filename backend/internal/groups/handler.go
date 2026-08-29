package groups

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

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

type GroupResponse struct {
	ID          int    `json:"id"`
	CreatorID   int    `json:"creator_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type ListGroupsResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message,omitempty"`
	Groups  []GroupResponse `json:"groups,omitempty"`
}

type GetGroupResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message,omitempty"`
	Group   *GroupResponse `json:"group,omitempty"`
}

func toGroupResponse(g *Group) GroupResponse {
	return GroupResponse{
		ID:          g.ID,
		CreatorID:   g.CreatorID,
		Title:       g.Title,
		Description: g.Description,
		CreatedAt:   g.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   g.UpdatedAt.Format(time.RFC3339),
	}
}

type GroupMemberResponse struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	JoinedAt string `json:"joined_at"`
}

type GetGroupMembersResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message,omitempty"`
	Members []GroupMemberResponse `json:"members,omitempty"`
}

func toGroupMemberResponse(m GroupMember) GroupMemberResponse {
	return GroupMemberResponse{
		UserID:   m.UserID,
		Username: m.Username,
		Role:     m.Role,
		JoinedAt: m.JoinedAt.Format(time.RFC3339),
	}
}

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// GroupsHandler dispatches requests on the /groups route by method.
func (h *Handler) GroupsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListGroupsHandler(w, r)
	case http.MethodPost:
		h.CreateGroupHandler(w, r)
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Method not allowed",
		})
	}
}

func (h *Handler) CreateGroupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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

func (h *Handler) ListGroupsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if _, ok := r.Context().Value(auth.UserIDKey).(int); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ListGroupsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	limit, offset, err := ValidatePagination(r.URL.Query().Get("limit"), r.URL.Query().Get("offset"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ListGroupsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	groupsList, err := h.service.GetAllGroups(limit, offset)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ListGroupsResponse{
			Success: false,
			Message: "Failed to get groups",
		})
		return
	}

	resp := make([]GroupResponse, len(groupsList))
	for i, g := range groupsList {
		resp[i] = toGroupResponse(&g)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ListGroupsResponse{
		Success: true,
		Groups:  resp,
	})
}

func (h *Handler) GetGroupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	if _, ok := r.Context().Value(auth.UserIDKey).(int); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	group, err := h.service.GetGroupByID(groupID)
	if err != nil {
		if errors.Is(err, ErrGroupNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(GetGroupResponse{
				Success: false,
				Message: "Group not found",
			})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: "Failed to get group",
		})
		return
	}

	groupResp := toGroupResponse(group)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetGroupResponse{
		Success: true,
		Group:   &groupResp,
	})
}

func (h *Handler) GetGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(GetGroupMembersResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	if _, ok := r.Context().Value(auth.UserIDKey).(int); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetGroupMembersResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupMembersResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	members, err := h.service.GetGroupMembers(groupID)
	if err != nil {
		if errors.Is(err, ErrGroupNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(GetGroupMembersResponse{
				Success: false,
				Message: "Group not found",
			})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetGroupMembersResponse{
			Success: false,
			Message: "Failed to get group members",
		})
		return
	}

	resp := make([]GroupMemberResponse, len(members))
	for i, m := range members {
		resp[i] = toGroupMemberResponse(m)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetGroupMembersResponse{
		Success: true,
		Members: resp,
	})
}
