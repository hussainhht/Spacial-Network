package users

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/internal/requestctx"
	"social/internal/upload"
)

func NewHandler(service *Service, avatarStorage AvatarStorage) *Handler {
	return &Handler{
		service:       service,
		avatarStorage: avatarStorage,
	}
}

func toProfileResponse(profile *Profile, canViewFullProfile bool, includePersonalInfo bool) ProfileResponse {
	resp := ProfileResponse{
		ID:                 profile.ID,
		Username:           profile.Username,
		FirstName:          profile.FirstName,
		LastName:           profile.LastName,
		IsPrivate:          profile.IsPrivate,
		CanViewFullProfile: canViewFullProfile,
	}

	if profile.ProfilePhoto.Valid {
		resp.ProfilePhoto = "/uploads/" + profile.ProfilePhoto.String
	}

	if includePersonalInfo {
		resp.UUID = profile.UUID
		resp.Age = profile.Age
		resp.Gender = profile.Gender
		resp.Email = profile.Email
		resp.CreatedAt = profile.CreatedAt.Format(time.RFC3339)
		resp.UpdatedAt = profile.UpdatedAt.Format(time.RFC3339)

		if profile.DateOfBirth.Valid {
			resp.DateOfBirth = profile.DateOfBirth.String
		}
	}

	if profile.Nickname.Valid {
		resp.Nickname = profile.Nickname.String
	}

	if canViewFullProfile {
		if profile.AboutMe.Valid {
			resp.AboutMe = profile.AboutMe.String
		}
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

	profileResponse := toProfileResponse(profile, true, true)

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

	viewerID, ok := requestctx.UserID(r.Context())
	if !ok {
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

	canViewFullProfile, err := h.service.CanViewFullProfile(viewerID, profile)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetProfileResponse{
			Success: false,
			Message: "Failed to check profile privacy",
		})
		return
	}

	profileResponse := toProfileResponse(profile, canViewFullProfile, viewerID == profile.ID)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GetProfileResponse{
		Success: true,
		Profile: &profileResponse,
	})
}

// UpdateProfileDetailsHandler updates editable profile fields for the current user.
func (h *Handler) UpdateProfileDetailsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPatch {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	var req UpdateProfileDetailsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
			Success: false,
			Message: "Invalid request",
		})
		return
	}

	if err := ValidateUpdateProfileDetailsRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	profile, err := h.service.UpdateProfileDetails(userID, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
				Success: false,
				Message: "User not found",
			})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
			Success: false,
			Message: "Failed to update profile details",
		})
		return
	}

	profileResponse := toProfileResponse(profile, true, true)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(UpdateProfileDetailsResponse{
		Success: true,
		Message: "Profile details updated",
		Profile: &profileResponse,
	})
}

const maxUpdateAvatarRequestSize = 6 << 20 // 6 MiB, including multipart overhead

// UpdateProfileAvatarHandler replaces or removes the current user's avatar.
func (h *Handler) UpdateProfileAvatarHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPatch {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Not logged in",
		})
		return
	}

	if h.avatarStorage == nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Avatar storage is not configured",
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUpdateAvatarRequestSize)
	if err := r.ParseMultipartForm(maxUpdateAvatarRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}

	var nextPhotoPath string
	var newSavedPath string

	file, header, fileErr := r.FormFile("profilePhoto")
	if fileErr != nil && !errors.Is(fileErr, http.ErrMissingFile) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Invalid profile photo upload",
		})
		return
	}

	if fileErr == nil {
		saved, err := h.avatarStorage.Save(file, header)
		file.Close()
		if err != nil {
			status := http.StatusBadRequest
			if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
				Success: false,
				Message: err.Error(),
			})
			return
		}
		newSavedPath = saved
		nextPhotoPath = saved
	} else if r.FormValue("remove_photo") != "true" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "profilePhoto or remove_photo is required",
		})
		return
	}

	profile, oldPhoto, err := h.service.UpdateProfilePhoto(userID, nextPhotoPath)
	if err != nil {
		if newSavedPath != "" {
			h.avatarStorage.Remove(newSavedPath)
		}

		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
				Success: false,
				Message: "User not found",
			})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
			Success: false,
			Message: "Failed to update profile photo",
		})
		return
	}

	if oldPhoto != "" && oldPhoto != nextPhotoPath {
		h.avatarStorage.Remove(oldPhoto)
	}

	profileResponse := toProfileResponse(profile, true, true)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(UpdateProfileAvatarResponse{
		Success: true,
		Message: "Profile photo updated",
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
