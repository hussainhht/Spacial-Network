package handlers

import (
	"encoding/json"
	"net/http"

	"social/db"
	"social/helpers"
	"social/models"

	"github.com/google/uuid"
)

type RegisterResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	UserID  string `json:"user_id,omitempty"`
}

func RegisterRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}
	var payload models.RegisterRequest

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}
	if err := helpers.ValidateAndSanitize(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	// Check if username already exists
	usernameExists, err := db.UsernameExists(payload.Username)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Database error",
		})
		return
	}
	if usernameExists {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Username already exists",
		})
		return
	}

	// Check if email already exists
	emailExists, err := db.EmailExists(payload.Email)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Database error",
		})
		return
	}
	if emailExists {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Email already exists",
		})
		return
	}

	// Generate UUID for the user
	userUUID := uuid.New().String()

	// Create user using queries package
	err = db.CreateUser(
		userUUID,
		payload.Username,
		payload.Age,
		payload.Gender,
		payload.FirstName,
		payload.LastName,
		payload.Email,
		payload.Password,
	)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Failed to create user",
		})
		return
	}

	// Success response
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(RegisterResponse{
		Success: true,
		Message: "User registered successfully",
		UserID:  userUUID,
	})
}
