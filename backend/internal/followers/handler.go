package followers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"social/internal/requestctx"
	"social/internal/users"
)

type Handler struct {
	service      *Service
	usersService *users.Service
}

func NewHandler(service *Service, usersService *users.Service) *Handler {
	return &Handler{
		service:      service,
		usersService: usersService,
	}
}

func toFollowRequestResponse(request FollowRequestWithRequester) FollowRequestResponse {
	return FollowRequestResponse{
		ID:        request.ID,
		Requester: request.Requester,
		Status:    request.Status,
		CreatedAt: request.CreatedAt.Format(time.RFC3339),
		UpdatedAt: request.UpdatedAt.Format(time.RFC3339),
	}
}

func (h *Handler) FollowUserHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	targetProfile, ok := h.targetProfileFromUsername(w, r)
	if !ok {
		return
	}

	if currentUserID != targetProfile.ID && targetProfile.IsPrivate {
		if err := h.service.CreateFollowRequest(currentUserID, targetProfile.ID); err != nil {
			status := http.StatusInternalServerError
			message := "Failed to create follow request"

			switch {
			case errors.Is(err, ErrCannotFollowSelf):
				status = http.StatusBadRequest
				message = err.Error()
			case errors.Is(err, ErrAlreadyFollowing), errors.Is(err, ErrFollowRequestAlreadyPending):
				status = http.StatusConflict
				message = err.Error()
			}

			w.WriteHeader(status)
			json.NewEncoder(w).Encode(FollowResponse{
				Success: false,
				Message: message,
			})
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: true,
			Message: "Follow request sent successfully",
		})
		return
	}

	if err := h.service.FollowUser(currentUserID, targetProfile.ID); err != nil {
		status := http.StatusInternalServerError
		message := "Failed to follow user"

		switch {
		case errors.Is(err, ErrCannotFollowSelf):
			status = http.StatusBadRequest
			message = err.Error()
		case errors.Is(err, ErrAlreadyFollowing):
			status = http.StatusConflict
			message = err.Error()
		}

		w.WriteHeader(status)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(FollowResponse{
		Success: true,
		Message: "User followed successfully",
	})
}

func (h *Handler) UnfollowUserHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	targetProfile, ok := h.targetProfileFromUsername(w, r)
	if !ok {
		return
	}

	if err := h.service.UnfollowUser(currentUserID, targetProfile.ID); err != nil {
		status := http.StatusInternalServerError
		message := "Failed to unfollow user"

		if errors.Is(err, ErrCannotFollowSelf) {
			status = http.StatusBadRequest
			message = err.Error()
		}

		w.WriteHeader(status)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowResponse{
		Success: true,
		Message: "User unfollowed successfully",
	})
}

func (h *Handler) GetFollowersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if _, ok := requestctx.UserID(r.Context()); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowListResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	targetProfile, ok := h.targetProfileFromUsername(w, r)
	if !ok {
		return
	}

	followers, err := h.service.GetFollowers(targetProfile.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(FollowListResponse{
			Success: false,
			Message: "Failed to get followers",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowListResponse{
		Success: true,
		Users:   followers,
	})
}

func (h *Handler) GetFollowingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if _, ok := requestctx.UserID(r.Context()); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowListResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	targetProfile, ok := h.targetProfileFromUsername(w, r)
	if !ok {
		return
	}

	following, err := h.service.GetFollowing(targetProfile.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(FollowListResponse{
			Success: false,
			Message: "Failed to get following",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowListResponse{
		Success: true,
		Users:   following,
	})
}

func (h *Handler) FollowStatusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowStatusResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	targetProfile, ok := h.targetProfileFromUsername(w, r)
	if !ok {
		return
	}

	isFollowing, err := h.service.IsFollowing(currentUserID, targetProfile.ID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(FollowStatusResponse{
			Success: false,
			Message: "Failed to get follow status",
		})
		return
	}

	hasPendingRequest := false
	if !isFollowing {
		hasPendingRequest, err = h.service.HasPendingFollowRequest(currentUserID, targetProfile.ID)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(FollowStatusResponse{
				Success: false,
				Message: "Failed to get follow request status",
			})
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowStatusResponse{
		Success:           true,
		IsFollowing:       isFollowing,
		HasPendingRequest: hasPendingRequest,
	})
}

func (h *Handler) GetPendingFollowRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowRequestsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	requests, err := h.service.GetPendingFollowRequests(currentUserID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(FollowRequestsResponse{
			Success: false,
			Message: "Failed to get follow requests",
		})
		return
	}

	responseRequests := make([]FollowRequestResponse, len(requests))
	for i, request := range requests {
		responseRequests[i] = toFollowRequestResponse(request)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowRequestsResponse{
		Success:  true,
		Requests: responseRequests,
	})
}

func validateFollowRequestID(raw string) (int, error) {
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, errors.New("follow request id must be a positive integer")
	}

	return id, nil
}

func followRequestErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, ErrFollowRequestNotFound):
		return http.StatusNotFound, "Follow request not found"
	case errors.Is(err, ErrFollowRequestNotPending):
		return http.StatusConflict, "Follow request has already been processed"
	default:
		return http.StatusInternalServerError, "Failed to process follow request"
	}
}

func (h *Handler) AcceptFollowRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	requestID, err := validateFollowRequestID(r.PathValue("requestID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.AcceptFollowRequest(requestID, currentUserID); err != nil {
		status, message := followRequestErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowResponse{
		Success: true,
		Message: "Follow request accepted",
	})
}

func (h *Handler) DeclineFollowRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currentUserID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	requestID, err := validateFollowRequestID(r.PathValue("requestID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := h.service.DeclineFollowRequest(requestID, currentUserID); err != nil {
		status, message := followRequestErrorResponse(err)
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: message,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FollowResponse{
		Success: true,
		Message: "Follow request declined",
	})
}

func (h *Handler) targetProfileFromUsername(w http.ResponseWriter, r *http.Request) (*users.Profile, bool) {
	username, err := users.ValidateUsername(r.PathValue("username"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: err.Error(),
		})
		return nil, false
	}

	profile, err := h.usersService.GetProfileByUsername(username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(FollowResponse{
				Success: false,
				Message: "User not found",
			})
			return nil, false
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(FollowResponse{
			Success: false,
			Message: "Failed to get user",
		})
		return nil, false
	}

	return profile, true
}
