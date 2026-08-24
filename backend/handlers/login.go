package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/db"
	"social/errs"
	"social/helpers"
	"social/models"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cookie, err := r.Cookie("session_token")
		if err == nil {
			// Check if session is valid
			_, err := db.ValidateSession(cookie.Value)
			if err == nil {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(models.Response{Message: "Already logged in"})
				return
			}
		}
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.Response{Error: "Invalid request"})
		return
	}
	if err := helpers.ValidateAndSanitize(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.Response{Error: err.Error()})
		return
	}

	userID, hashedPassword, err := db.CheckUserCredentials(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, errs.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(models.Response{Error: "Invalid username/email or password"})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.Response{Error: "Server error1"})
		return
	}

	if !helpers.ComparePasswords(hashedPassword, req.Password) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.Response{Error: "Invalid username/email or password"})
		return
	}

	// Generate session token
	token, err := helpers.GenerateSessionToken()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.Response{Error: "Server error2"})
		return
	}

	// Insert or update session in DB
	if err := db.CreateSession(userID, token); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.Response{Error: "Server error3"})
		return
	}

	//USER PRESENCE LOGIC OMMITED FOR TESTING
	// if err := db.MarkUserOnline(userID); err != nil {
	// 	w.WriteHeader(http.StatusInternalServerError)
	// 	json.NewEncoder(w).Encode(models.Response{Error: "Server error"})
	// 	return
	// }

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(30 * time.Minute),
		HttpOnly: true,
		Secure:   false, // true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.Response{Message: "Login successful"})
}
