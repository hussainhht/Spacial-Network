package users

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/internal/requestctx"
)

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func toProfileResponse(profile *Profile) ProfileResponse {
	resp := ProfileResponse{
		ID:        profile.ID,
		UUID:      profile.UUID,
		Username:  profile.Username,
		Age:       profile.Age,
		Gender:    profile.Gender,
		FirstName: profile.FirstName,
		LastName:  profile.LastName,
		Email:     profile.Email,
		CreatedAt: profile.CreatedAt.Format(time.RFC3339),
		UpdatedAt: profile.UpdatedAt.Format(time.RFC3339),
		IsPrivate: profile.IsPrivate,
	}

	if profile.ProfilePhoto.Valid {
		resp.ProfilePhoto = "/uploads/" + profile.ProfilePhoto.String
	}

	return resp
}

// GetMeHandler returns the profile of the currently logged-in user.
func (h *Handler) GetMeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	profile, err := h.service.GetProfileByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(GetProfileResponse{
				Success: false,
				Message: "User not found",
			})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Failed to get profile",
		})
		return
	}

	profileResponse := toProfileResponse(profile)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetProfileResponse{
		Success: true,
		Profile: &profileResponse,
	})
}

// GetProfileHandler retrieves a user's profile by their username.
func (h *Handler) GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	if _, ok := requestctx.UserID(r.Context()); !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	username, err := ValidateUsername(r.PathValue("username"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	profile, err := h.service.GetProfileByUsername(username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(GetProfileResponse{
				Success: false,
				Message: "User not found",
			})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Failed to get profile",
		})
		return
	}

	profileResponse := toProfileResponse(profile)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetProfileResponse{
		Success: true,
		Profile: &profileResponse,
	})
}

// UpdateProfilePrivacyHandler updates the privacy setting of the currently logged-in user's profile.
func (h *Handler) UpdateProfilePrivacyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPatch {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	var req UpdateProfilePrivacyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
			Success: false,
			Message: "Invalid request",
		})
		return
	}

	if req.IsPrivate == nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
			Success: false,
			Message: "is_private is required",
		})
		return
	}

	if err := h.service.UpdateProfilePrivacy(userID, *req.IsPrivate); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
				Success: false,
				Message: "User not found",
			})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
			Success: false,
			Message: "Failed to update profile privacy",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(UpdateProfilePrivacyResponse{
		Success:   true,
		Message:   "Profile privacy updated",
		IsPrivate: *req.IsPrivate,
	})
}
