package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"social/db"
	"social/middleware"
	"social/models"
)

// Response already defined in login.go; reusable across handlers.

// LogoutHandler revokes the current session and clears its cookie.
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// accept GET for simple links and POST for API calls
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_token")
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.Response{Error: "Not logged in"})
		return
	}

	_, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		_, err = db.ValidateSession(cookie.Value)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(models.Response{Error: "Invalid session"})
			return
		}
	}

	if err := db.RevokeSession(cookie.Value); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.Response{Error: "Server error"})
		return
	}

	//USER PRESENCE LOGIC OMMITED FOR TESTING
	// if err := db.MarkUserOffline(userID); err != nil {
	// 	w.WriteHeader(http.StatusInternalServerError)
	// 	json.NewEncoder(w).Encode(models.Response{Error: "Server error"})
	// 	return
	// }

	// clear the cookie on client side
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.Response{Message: "Logged out"})
}
