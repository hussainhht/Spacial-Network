package middleware

import (
	"net/http"

	"social/internal/auth"
	"social/internal/requestctx"
)

func SessionMiddleware(authService *auth.Service, cookieName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get cookie
			cookie, err := r.Cookie(cookieName)
			if err != nil {
				http.Error(w, "Unauthorized: Cookie Not Found", http.StatusUnauthorized)
				return
			}

			// Validate session
			userID, err := authService.ValidateSession(cookie.Value)
			if err != nil {
				http.Error(w, "Unauthorized: invalid session", http.StatusUnauthorized)
				return
			}

			if err := authService.UpdateSessionExpiry(cookie.Value); err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			ctx := requestctx.WithUserID(r.Context(), userID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
