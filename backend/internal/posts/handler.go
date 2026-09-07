package posts

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
)

// maxNewPostRequestSize bounds the total size of a create-post request
// (form fields plus the optional image attachment).
const maxNewPostRequestSize = 8 << 20 // 8 MiB

type Handler struct {
	service         *Service
	usersService    *users.Service
	mediaStorage    *upload.MediaStorage
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
	ImageURL  string    `json:"image_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// IsOwner tells the client whether the requesting user owns this post,
	// so it knows whether to offer edit/delete actions.
	IsOwner bool `json:"is_owner"`
}

func newPostResponse(p *post, viewerID int) PostResponse {
	resp := PostResponse{
		ID:        p.ID,
		UserID:    p.User_ID,
		Private:   p.isPrivate,
		Title:     p.Title,
		Content:   p.Content,
		CreatedAt: p.Created_At,
		UpdatedAt: p.Updated_At,
		IsOwner:   p.User_ID == viewerID,
	}
	if p.ImagePath.Valid {
		resp.ImageURL = "/uploads/" + p.ImagePath.String
	}
	return resp
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service, mediaStorage *upload.MediaStorage, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		mediaStorage:    mediaStorage,
		cookieName:      cookieName,
		cookieSecure:    cookieSecure,
		sessionLifetime: sessionLifetime,
	}
}

// NewPostHandler handles the creation of a new post.
// It expects a JSON payload with the post's title, content, and privacy setting.
// The user must be authenticated to create a post.
// NewPostHandler expects a multipart/form-data body with "title",
// "content", and "private" fields, plus an optional "image" file
// attachment (JPEG, PNG, GIF, or WebP).
func (h *Handler) NewPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(errMethodNotAllowed)
		return
	}

	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxNewPostRequestSize)
	if err := r.ParseMultipartForm(maxNewPostRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request payload or body"})
		return
	}

	req := NewPostRequest{
		Title:   r.FormValue("title"),
		Content: r.FormValue("content"),
		Private: r.FormValue("private") == "true",
	}

	if err := ValidateNewPostRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	var imagePath string
	file, header, err := r.FormFile("image")
	if err != nil && !errors.Is(err, http.ErrMissingFile) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid image upload"})
		return
	}
	if err == nil {
		imagePath, err = h.mediaStorage.Save(file, header)
		file.Close()
		if err != nil {
			status := http.StatusBadRequest
			if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(Response{Error: err.Error()})
			return
		}
	}

	p := &post{
		User_ID:   userID,
		isPrivate: req.Private,
		Title:     req.Title,
		Content:   req.Content,
		ImagePath: sql.NullString{String: imagePath, Valid: imagePath != ""},
	}

	if err := h.service.CreatePost(p); err != nil {
		h.mediaStorage.Remove(imagePath)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newPostResponse(p, userID))
}

// GetPostByIDHandler retrieves a post by its ID.
// It expects the post ID to be provided as a path parameter.
// The user must be authenticated, and private posts are only visible to
// their owner - to anyone else a private post looks the same as one that
// doesn't exist.
func (h *Handler) GetPostByIDHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
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
	json.NewEncoder(w).Encode(newPostResponse(p, userID))
}

// ListPostsHandler returns up to 50 posts visible to the logged-in user: all
// public posts plus their own private posts, newest first. The optional
// "limit" query parameter requests fewer posts (capped at 50).
func (h *Handler) ListPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	limit := MaxListPosts
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Response{Error: "Invalid limit"})
			return
		}
		limit = parsed
	}

	posts, err := h.service.ListPosts(userID, limit)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	res := make([]PostResponse, 0, len(posts))
	for _, p := range posts {
		res = append(res, newPostResponse(p, userID))
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

// EditPostHandler handles editing a single post, identified by the {id}
// path segment. It is registered on its own PUT/PATCH routes, so the
// method is guaranteed by the router.
func (h *Handler) EditPostHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
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
	userID, ok := requestctx.UserID(r.Context())
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
