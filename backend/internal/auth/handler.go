package auth

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
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
	Username    string `json:"username"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Gender      string `json:"gender"`
	DateOfBirth string `json:"dateOfBirth"`
	Nickname    string `json:"nickname"`
	AboutMe     string `json:"aboutMe"`
	// Age is derived from DateOfBirth during validation, not client-supplied.
	Age int `json:"-"`
}

type Response struct {
	Message      string `json:"message,omitempty"`
	UserID       int    `json:"user_id,omitempty"`
	Username     string `json:"username,omitempty"`
	FirstName    string `json:"first_name,omitempty"`
	LastName     string `json:"last_name,omitempty"`
	ProfilePhoto string `json:"profile_photo,omitempty"`
	Error        string `json:"error,omitempty"`
}

func (h *Handler) responseForUser(userID int, message string) Response {
	resp := Response{Message: message, UserID: userID}
	summaries, err := h.usersService.GetSummariesByIDs([]int{userID})
	if err != nil {
		return resp
	}
	if summary, ok := summaries[userID]; ok {
		resp.Username = summary.Username
		resp.FirstName = summary.FirstName
		resp.LastName = summary.LastName
		resp.ProfilePhoto = summary.ProfilePhoto
	}
	return resp
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
			userID, err := h.service.ValidateSession(cookie.Value)
			if err == nil {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(h.responseForUser(userID, "Already logged in"))
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

	userID, token, err := h.service.Login(req.Username, req.Password)
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
	json.NewEncoder(w).Encode(h.responseForUser(userID, "Login successful"))
}

// LogoutHandler revokes the current session and clears its cookie.
func (h *Handler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
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

	payload := RegisterRequest{
		Username:    r.FormValue("username"),
		FirstName:   r.FormValue("firstName"),
		LastName:    r.FormValue("lastName"),
		Email:       r.FormValue("email"),
		Password:    r.FormValue("password"),
		Gender:      r.FormValue("gender"),
		DateOfBirth: r.FormValue("dateOfBirth"),
		Nickname:    r.FormValue("nickname"),
		AboutMe:     r.FormValue("aboutMe"),
	}

	if err := ValidateRegisterRequest(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

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

	userUUID := uuid.New().String()

	userID, err := h.usersService.CreateUser(
		userUUID,
		payload.Username,
		payload.Age,
		payload.DateOfBirth,
		payload.Gender,
		payload.FirstName,
		payload.LastName,
		payload.Email,
		payload.Password,
		profilePhotoPath,
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

	// Nickname/about-me are optional at registration; save them best-effort
	// through the existing profile-update path rather than failing account
	// creation over a cosmetic field.
	if payload.Nickname != "" || payload.AboutMe != "" {
		nickname, aboutMe, dateOfBirth := payload.Nickname, payload.AboutMe, payload.DateOfBirth
		if _, err := h.usersService.UpdateProfileDetails(userID, users.UpdateProfileDetailsRequest{
			FirstName:   payload.FirstName,
			LastName:    payload.LastName,
			Nickname:    &nickname,
			AboutMe:     &aboutMe,
			DateOfBirth: &dateOfBirth,
		}); err != nil {
			log.Printf("register: failed to save optional profile details for user %d: %v", userID, err)
		}
	}

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
