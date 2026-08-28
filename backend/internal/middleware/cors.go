package middleware

import "net/http"

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		// Set CORS headers
		w.Header().Set(
			"Access-Control-Allow-Origin",
			"http://localhost:3000",
		)

		// Allow credentials (cookies, authorization headers, etc.)
		w.Header().Set(
			"Access-Control-Allow-Credentials",
			"true",
		)

		// Allow specific HTTP methods
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		)

		// Allow specific headers
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		// Browser CORS preflight request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}