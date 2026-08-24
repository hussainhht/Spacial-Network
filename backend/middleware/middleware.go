package middleware

import (
	"context"
	"net/http"
	"social/db"
)

type contextKey string

const UserIDKey contextKey = "userID"

func SessionMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get cookie
			cookie, err := r.Cookie("session_token")
			if err != nil {
				http.Error(w, "Unauthorized: Cookie Not Found", http.StatusUnauthorized)
				return
			}

			// Validate session using DB function
			userID, err := db.ValidateSession(cookie.Value)
			if err != nil {
				http.Error(w, "Unauthorized: invalid session", http.StatusUnauthorized)
				return
			}

			updateErr := db.UpdateSessionExpiry(cookie.Value)
			if updateErr != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			// if err := db.MarkUserOnline(userID); err != nil {
			// 	http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			// 	return
			// }

			ctx := context.WithValue(r.Context(), UserIDKey, userID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
