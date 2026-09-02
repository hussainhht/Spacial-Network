package posts

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"social/internal/auth"
	"social/internal/users"
)

type Handler struct {
	service         *Service
	usersService    *users.Service
	cookieName      string
	cookieSecure    bool
	sessionLifetime time.Duration
}

type Response struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type NewPostRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Private bool   `json:"private"`
}

type EditPostRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Private bool   `json:"private"`
}

// PostResponse is the JSON-serializable view of a post returned to clients.
type PostResponse struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Private   bool      `json:"private"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func newPostResponse(p *post) PostResponse {
	return PostResponse{
		ID:        p.ID,
		UserID:    p.User_ID,
		Private:   p.isPrivate,
		Title:     p.Title,
		Content:   p.Content,
		CreatedAt: p.Created_At,
		UpdatedAt: p.Updated_At,
	}
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		cookieName:      cookieName,
		cookieSecure:    cookieSecure,
		sessionLifetime: sessionLifetime,
	}
}

// NewPostHandler handles the creation of a new post.
// It expects a JSON payload with the post's title, content, and privacy setting.
// The user must be authenticated to create a post.
func (h *Handler) NewPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(errMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	var req NewPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request"})
		return
	}

	if err := ValidateNewPostRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	p := &post{
		User_ID:   userID,
		isPrivate: req.Private,
		Title:     req.Title,
		Content:   req.Content,
	}

	if err := h.service.CreatePost(p); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Response{Message: "Post created"})
}

// GetPostByIDHandler retrieves a post by its ID.
// It expects the post ID to be provided as a path parameter.
// The user must be authenticated, and private posts are only visible to
// their owner - to anyone else a private post looks the same as one that
// doesn't exist.
func (h *Handler) GetPostByIDHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	postID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid post id"})
		return
	}

	p, err := h.service.GetPostByID(postID)
	if err != nil {
		writePostError(w, err)
		return
	}

	if p.isPrivate && p.User_ID != userID {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(newPostResponse(p))
}

// EditPostHandler handles editing a single post, identified by the {id}
// path segment. It is registered on its own PUT/PATCH routes, so the
// method is guaranteed by the router.
func (h *Handler) EditPostHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	postID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid post id"})
		return
	}

	var req EditPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request"})
		return
	}

	if err := ValidateEditPostRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	if err := h.service.UpdatePost(userID, postID, req.Title, req.Content, req.Private); err != nil {
		writePostError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Message: "Post updated"})
}

// DeletePostHandler handles deleting a single post, identified by the {id}
// path segment. It is registered on its own DELETE route, so the method is
// guaranteed by the router.
func (h *Handler) DeletePostHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(int)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	postID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid post id"})
		return
	}

	if err := h.service.DeletePost(userID, postID); err != nil {
		writePostError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Message: "Post deleted"})
}

// writePostError maps a service error to the appropriate HTTP status code
// and writes the JSON error response.
func writePostError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPostNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
	case errors.Is(err, ErrForbidden):
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(Response{Error: "Not allowed to modify this post"})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
	}
}
