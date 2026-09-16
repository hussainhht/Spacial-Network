package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"social/internal/requestctx"
)

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type ChangePasswordResponse struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

func ValidateChangePasswordRequest(req *ChangePasswordRequest) error {
	if req == nil {
		return errors.New("invalid password change payload")
	}

	currentPassword := strings.TrimSpace(req.CurrentPassword)
	if currentPassword == "" {
		return errors.New("current password is required")
	}

	newPassword, err := ValidatePassword(req.NewPassword)
	if err != nil {
		return err
	}

	req.CurrentPassword = currentPassword
	req.NewPassword = newPassword
	return nil
}

// ChangePasswordHandler changes only the password belonging to the user in
// the authenticated request context. It never returns either password or the
// stored hash.
func (h *Handler) ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPatch {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "Method not allowed"})
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "Not logged in"})
		return
	}

	var req ChangePasswordRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "Invalid request"})
		return
	}

	if err := ValidateChangePasswordRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ChangePasswordResponse{Error: err.Error()})
		return
	}

	if err := h.service.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "Current password is incorrect"})
		case errors.Is(err, sql.ErrNoRows):
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "User not found"})
		default:
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ChangePasswordResponse{Error: "Failed to change password"})
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ChangePasswordResponse{Message: "Password changed successfully"})
}
