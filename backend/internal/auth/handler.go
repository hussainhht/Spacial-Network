package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"social/internal/users"
	"social/pkg/errs"

	"github.com/google/uuid"
)

type contextKey string

const UserIDKey contextKey = "userID"

// LoginRequest represents the JSON body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username  string `json:"username"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	Gender    string `json:"gender"`
	Age       int    `json:"age"`
}

type Response struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type RegisterResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	UserID  string `json:"user_id,omitempty"`
}

type Handler struct {
	service         *Service
	usersService    *users.Service
	cookieName      string
	cookieSecure    bool
	sessionLifetime time.Duration
}

func NewHandler(service *Service, usersService *users.Service, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		usersService:    usersService,
		cookieName:      cookieName,
		cookieSecure:    cookieSecure,
		sessionLifetime: sessionLifetime,
	}
}

func (h *Handler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cookie, err := r.Cookie(h.cookieName)
		if err == nil {
			// Check if session is valid
			_, err := h.service.ValidateSession(cookie.Value)
			if err == nil {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(Response{Message: "Already logged in"})
				return
			}
		}
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request"})
		return
	}
	if err := ValidateLoginRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	_, token, err := h.service.Login(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, errs.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(Response{Error: "Invalid username/email or password"})
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     h.cookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(h.sessionLifetime),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Message: "Login successful"})
}

// LogoutHandler revokes the current session and clears its cookie.
func (h *Handler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// accept GET for simple links and POST for API calls
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie(h.cookieName)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	if _, ok := r.Context().Value(UserIDKey).(int); !ok {
		if _, err := h.service.ValidateSession(cookie.Value); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(Response{Error: "Invalid session"})
			return
		}
	}

	if err := h.service.Logout(cookie.Value); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	// clear the cookie on client side
	http.SetCookie(w, &http.Cookie{
		Name:     h.cookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Message: "Logged out"})
}

func (h *Handler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}
	var payload RegisterRequest

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}
	if err := ValidateRegisterRequest(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	// Check if username already exists
	usernameExists, err := h.usersService.UsernameExists(payload.Username)
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
	emailExists, err := h.usersService.EmailExists(payload.Email)
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

	// Create the user
	err = h.usersService.CreateUser(
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
