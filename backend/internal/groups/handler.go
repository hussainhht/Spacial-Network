package groups

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/internal/auth"
)

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

func toGroupMemberResponse(m GroupMember) GroupMemberResponse {
	return GroupMemberResponse{
		UserID:   m.UserID,
		Username: m.Username,
		Role:     m.Role,
		JoinedAt: m.JoinedAt.Format(time.RFC3339),
	}
}

func toGroupJoinRequestResponse(jr GroupJoinRequest) GroupJoinRequestResponse {
	return GroupJoinRequestResponse{
		ID:        jr.ID,
		GroupID:   jr.GroupID,
		UserID:    jr.UserID,
		Status:    jr.Status,
		CreatedAt: jr.CreatedAt.Format(time.RFC3339),
		UpdatedAt: jr.UpdatedAt.Format(time.RFC3339),
	}
}

func toGroupInvitationResponse(inv GroupInvitation) GroupInvitationResponse {
	return GroupInvitationResponse{
		ID:            inv.ID,
		GroupID:       inv.GroupID,
		InvitedBy:     inv.InvitedBy,
		InvitedUserID: inv.InvitedUserID,
		Status:        inv.Status,
		CreatedAt:     inv.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     inv.UpdatedAt.Format(time.RFC3339),
	}
}

func toInviteCandidateResponse(c InviteCandidate) InviteCandidateResponse {
	return InviteCandidateResponse{
		ID:        c.ID,
		Username:  c.Username,
		FirstName: c.FirstName,
		LastName:  c.LastName,
		Avatar:    c.ProfilePhoto,
	}
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
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

func (h *Handler) GetMembershipHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(MembershipResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MembershipResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	member, err := h.service.GetMembership(groupID, userID)
	if err != nil {
		if errors.Is(err, ErrGroupNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(MembershipResponse{
				Success: false,
				Message: "Group not found",
			})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(MembershipResponse{
			Success: false,
			Message: "Failed to get membership status",
		})
		return
	}

	resp := MembershipResponse{Success: true, IsMember: member != nil}
	if member != nil {
		resp.Role = member.Role
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) CreateJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(CreateJoinRequestResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateJoinRequestResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.RequestToJoin(groupID, userID); err != nil {
		status, message := joinRequestErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(CreateJoinRequestResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateJoinRequestResponse{
		Success: true,
		Message: "Join request sent successfully",
	})
}

func (h *Handler) GetPendingJoinRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetJoinRequestsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetJoinRequestsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	requests, err := h.service.GetPendingJoinRequests(groupID, userID)
	if err != nil {
		status, message := joinRequestErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(GetJoinRequestsResponse{
			Success: false,
			Message: message,
		})
		return
	}

	resp := make([]GroupJoinRequestResponse, len(requests))
	for i, jr := range requests {
		resp[i] = toGroupJoinRequestResponse(jr)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetJoinRequestsResponse{
		Success:      true,
		JoinRequests: resp,
	})
}

func (h *Handler) AcceptJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
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

	requestID, err := ValidateJoinRequestID(r.PathValue("requestID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.AcceptJoinRequest(groupID, requestID, userID); err != nil {
		status, message := joinRequestErrorResponse(err)
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
		Message: "Join request accepted",
	})
}

func (h *Handler) RejectJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
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

	requestID, err := ValidateJoinRequestID(r.PathValue("requestID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.RejectJoinRequest(groupID, requestID, userID); err != nil {
		status, message := joinRequestErrorResponse(err)
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
		Message: "Join request rejected",
	})
}

// =========================
// Group Invitations
// =========================

func (h *Handler) CreateGroupInvitationHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	var req CreateGroupInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
			Success: false,
			Message: "Invalid request payload",
		})
		return
	}

	invitedUserID, err := ValidateInvitedUserID(req.InvitedUserID)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.CreateGroupInvitation(groupID, userID, invitedUserID); err != nil {
		status, message := invitationErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CreateGroupInvitationResponse{
		Success: true,
		Message: "Invitation sent successfully",
	})
}

func (h *Handler) GetPendingInvitationsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetGroupInvitationsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	invitations, err := h.service.GetPendingInvitations(userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetGroupInvitationsResponse{
			Success: false,
			Message: "Failed to get invitations",
		})
		return
	}

	resp := make([]GroupInvitationResponse, len(invitations))
	for i, inv := range invitations {
		resp[i] = toGroupInvitationResponse(inv)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetGroupInvitationsResponse{
		Success:     true,
		Invitations: resp,
	})
}

func (h *Handler) AcceptGroupInvitationHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	invitationID, err := ValidateInvitationID(r.PathValue("invitationID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.AcceptGroupInvitation(invitationID, userID); err != nil {
		status, message := invitationErrorResponse(err)
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
		Message: "Invitation accepted",
	})
}

func (h *Handler) DeclineGroupInvitationHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	invitationID, err := ValidateInvitationID(r.PathValue("invitationID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.DeclineGroupInvitation(invitationID, userID); err != nil {
		status, message := invitationErrorResponse(err)
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
		Message: "Invitation declined",
	})
}
