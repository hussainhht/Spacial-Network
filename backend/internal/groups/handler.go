package groups

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/internal/requestctx"
	"social/internal/upload"
)

func toGroupResponse(g *Group) GroupResponse {
	return GroupResponse{
		ID:              g.ID,
		CreatorUsername: g.CreatorUsername, MemberCount: g.MemberCount, MembershipRole: g.MembershipRole, HasPendingJoinRequest: g.HasPendingJoinRequest, HasPendingInvitation: g.HasPendingInvitation,
		CreatorID:   g.CreatorID,
		Title:       g.Title,
		Description: g.Description,
		Privacy:     g.Privacy,
		GroupPhoto:  g.GroupPhoto,
		CreatedAt:   g.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   g.UpdatedAt.Format(time.RFC3339),
	}
}

func toGroupMemberResponse(m GroupMember) GroupMemberResponse {
	return GroupMemberResponse{
		UserID: m.UserID, Avatar: m.Avatar,
		Username: m.Username,
		Role:     m.Role,
		JoinedAt: m.JoinedAt.Format(time.RFC3339),
	}
}

func toGroupJoinRequestResponse(jr GroupJoinRequest) GroupJoinRequestResponse {
	return GroupJoinRequestResponse{
		ID: jr.ID, Username: jr.Username,
		GroupID:   jr.GroupID,
		UserID:    jr.UserID,
		Status:    jr.Status,
		CreatedAt: jr.CreatedAt.Format(time.RFC3339),
		UpdatedAt: jr.UpdatedAt.Format(time.RFC3339),
	}
}

func toGroupInvitationResponse(inv GroupInvitation) GroupInvitationResponse {
	return GroupInvitationResponse{
		ID: inv.ID, GroupTitle: inv.GroupTitle, GroupPrivacy: inv.GroupPrivacy, InviterUsername: inv.InviterUsername,
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

// maxCreateGroupRequestSize bounds the total size of a create-group request
// body (form fields plus one optional group photo) accepted before it is
// rejected.
const maxCreateGroupRequestSize = 8 << 20 // 8 MiB

func NewHandler(service *Service, photoStorage *upload.AvatarStorage, eventStorage ...*upload.MediaStorage) *Handler {
	var events *upload.MediaStorage
	if len(eventStorage) > 0 {
		events = eventStorage[0]
	}
	return &Handler{
		service:      service,
		photoStorage: photoStorage,
		eventStorage: events,
	}
}

func (h *Handler) CreateGroupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxCreateGroupRequestSize)
	if err := r.ParseMultipartForm(maxCreateGroupRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}

	title, err := ValidateTitle(r.FormValue("title"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	description, err := ValidateDescription(r.FormValue("description"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	privacy, err := ValidatePrivacy(r.FormValue("privacy"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	// Handle the optional group photo upload.
	var photoPath string
	file, header, err := r.FormFile("groupPhoto")
	if err != nil && !errors.Is(err, http.ErrMissingFile) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(CreateGroupResponse{
			Success: false,
			Message: "Invalid group photo upload",
		})
		return
	}
	if err == nil {
		photoPath, err = h.photoStorage.Save(file, header)
		file.Close()
		if err != nil {
			status := http.StatusBadRequest
			if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(CreateGroupResponse{
				Success: false,
				Message: err.Error(),
			})
			return
		}
	}

	groupID, err := h.service.CreateGroup(userID, title, description, photoPath, privacy)
	if err != nil {
		h.photoStorage.Remove(photoPath)
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

// maxUpdateGroupRequestSize bounds the total size of an update-group request
// body (form fields plus one optional group photo) accepted before it is
// rejected.
const maxUpdateGroupRequestSize = 8 << 20 // 8 MiB

func (h *Handler) UpdateGroupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	r.Body = http.MaxBytesReader(w, r.Body, maxUpdateGroupRequestSize)
	if err := r.ParseMultipartForm(maxUpdateGroupRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}

	title, err := ValidateTitle(r.FormValue("title"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	description, err := ValidateDescription(r.FormValue("description"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	// Photo handling has three outcomes: a new file replaces the photo, an
	// explicit remove_photo flag clears it, or - the default - it's left
	// exactly as it is. A nil photoPath means "don't touch the column".
	var photoPath *string
	var newSavedPath string
	file, header, fileErr := r.FormFile("groupPhoto")
	if fileErr != nil && !errors.Is(fileErr, http.ErrMissingFile) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: "Invalid group photo upload",
		})
		return
	}
	if fileErr == nil {
		saved, err := h.photoStorage.Save(file, header)
		file.Close()
		if err != nil {
			status := http.StatusBadRequest
			if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(GetGroupResponse{
				Success: false,
				Message: err.Error(),
			})
			return
		}
		newSavedPath = saved
		photoPath = &newSavedPath
	} else if r.FormValue("remove_photo") == "true" {
		empty := ""
		photoPath = &empty
	}

	group, oldPhoto, err := h.service.UpdateGroup(groupID, userID, title, description, photoPath)
	if err != nil {
		if newSavedPath != "" {
			h.photoStorage.Remove(newSavedPath)
		}
		status, message := updateGroupErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(GetGroupResponse{
			Success: false,
			Message: message,
		})
		return
	}

	// The DB write succeeded and no longer references the old file (if the
	// photo changed or was removed) - safe to delete it now.
	if photoPath != nil && oldPhoto != "" && oldPhoto != *photoPath {
		h.photoStorage.Remove(oldPhoto)
	}

	groupResp := toGroupResponse(group)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetGroupResponse{
		Success: true,
		Message: "Group updated successfully",
		Group:   &groupResp,
	})
}

// DeleteGroupHandler permanently deletes a group. Only the group's creator,
// taken from the session, may do this.
func (h *Handler) DeleteGroupHandler(w http.ResponseWriter, r *http.Request) {
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

	photo, err := h.service.DeleteGroup(groupID, userID)
	if err != nil {
		status, message := deleteGroupErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: message,
		})
		return
	}

	if photo != "" {
		h.photoStorage.Remove(photo)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ActionResponse{
		Success: true,
		Message: "Group deleted",
	})
}

func (h *Handler) ListGroupsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	search, err := ValidateGroupSearchQuery(r.URL.Query().Get("search"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ListGroupsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	groupsList, err := h.service.GetAllGroups(limit, offset, userID, search)
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

// GetMyGroupsHandler returns the groups the current session's user actually
// belongs to (creator or member), for the "My Groups" section.
func (h *Handler) GetMyGroupsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	search, err := ValidateGroupSearchQuery(r.URL.Query().Get("search"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ListGroupsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	groupsList, err := h.service.GetUserGroups(userID, limit, offset, search)
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

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	group, err := h.service.GetGroupForUser(groupID, userID)
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

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	members, err := h.service.GetVisibleGroupMembers(groupID, userID)
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

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(MembershipResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
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

	pending, err := h.service.HasPendingJoinRequest(groupID, userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(MembershipResponse{Message: "Failed to get membership status"})
		return
	}
	resp := MembershipResponse{Success: true, IsMember: member != nil, HasPendingJoinRequest: pending}
	if member != nil {
		resp.Role = member.Role
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) CreateJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
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

	err = h.service.RequestToJoin(groupID, userID)
	if err != nil {
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

func (h *Handler) CancelJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ActionResponse{Success: false, Message: "Not logged in"})
		return
	}

	groupID, err := ValidateGroupID(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{Success: false, Message: err.Error()})
		return
	}

	if err := h.service.CancelJoinRequest(groupID, userID); err != nil {
		status, message := joinRequestErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(ActionResponse{Success: false, Message: message})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ActionResponse{Success: true, Message: "Join request cancelled"})
}

func (h *Handler) GetPendingJoinRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
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

// RemoveMemberHandler lets the group's creator remove another member.
// The actor is always taken from the session, never from the request body.
func (h *Handler) RemoveMemberHandler(w http.ResponseWriter, r *http.Request) {
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

	memberID, err := ValidateMemberID(r.PathValue("memberID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.RemoveMember(groupID, userID, memberID); err != nil {
		status, message := removeMemberErrorResponse(err)
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
		Message: "Member removed",
	})
}

// =========================
// Group Invitations
// =========================

func (h *Handler) CreateGroupInvitationHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := requestctx.UserID(r.Context())
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

	userID, ok := requestctx.UserID(r.Context())
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

	userID, ok := requestctx.UserID(r.Context())
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

	userID, ok := requestctx.UserID(r.Context())
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
