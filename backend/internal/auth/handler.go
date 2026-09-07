package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"

	"github.com/google/uuid"
)

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
	AboutMe   string `json:"aboutMe"`
	Nickname  string `json:"nickname"`
}

type Response struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type RegisterResponse struct {
	Success         bool   `json:"success"`
	Message         string `json:"message"`
	UserID          string `json:"user_id,omitempty"`
	ProfilePhotoURL string `json:"profile_photo_url,omitempty"`
}

// maxRegisterRequestSize bounds the total size of a registration request
// body (form fields plus one profile photo) accepted before it is rejected.
const maxRegisterRequestSize = 8 << 20 // 8 MiB

type Handler struct {
	service         *Service
	usersService    *users.Service
	avatarStorage   *upload.AvatarStorage
	cookieName      string
	cookieSecure    bool
	sessionLifetime time.Duration
}

func NewHandler(service *Service, usersService *users.Service, avatarStorage *upload.AvatarStorage, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		usersService:    usersService,
		avatarStorage:   avatarStorage,
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
		if errors.Is(err, ErrInvalidCredentials) {
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

	if _, ok := requestctx.UserID(r.Context()); !ok {
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

	r.Body = http.MaxBytesReader(w, r.Body, maxRegisterRequestSize)
	if err := r.ParseMultipartForm(maxRegisterRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Invalid request payload or body",
		})
		return
	}

	age, err := strconv.Atoi(r.FormValue("age"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "age must be a number",
		})
		return
	}

	payload := RegisterRequest{
		Username:  r.FormValue("username"),
		FirstName: r.FormValue("firstName"),
		LastName:  r.FormValue("lastName"),
		Email:     r.FormValue("email"),
		Password:  r.FormValue("password"),
		Gender:    r.FormValue("gender"),
		Age:       age,
		AboutMe:   r.FormValue("about_me"),
		Nickname:  r.FormValue("nickname"),
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

	// Handle the optional profile photo upload.
	var profilePhotoPath string
	file, header, err := r.FormFile("profilePhoto")
	if err != nil && !errors.Is(err, http.ErrMissingFile) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Invalid profile photo upload",
		})
		return
	}
	if err == nil {
		profilePhotoPath, err = h.avatarStorage.Save(file, header)
		file.Close()
		if err != nil {
			status := http.StatusBadRequest
			if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(RegisterResponse{
				Success: false,
				Message: err.Error(),
			})
			return
		}
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
		profilePhotoPath,
		payload.AboutMe,
		payload.Nickname,
	)

	if err != nil {
		h.avatarStorage.Remove(profilePhotoPath)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: "Failed to create user",
		})
		return
	}

	// Success response
	resp := RegisterResponse{
		Success: true,
		Message: "User registered successfully",
		UserID:  userUUID,
	}
	if profilePhotoPath != "" {
		resp.ProfilePhotoURL = "/uploads/" + profilePhotoPath
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}
