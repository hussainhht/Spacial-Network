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
	Title      string `json:"title"`
	Content    string `json:"content"`
	Visibility string `json:"visibility"`
	ViewerIDs  []int  `json:"viewer_ids"`
}

type EditPostRequest struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Visibility string `json:"visibility"`
	ViewerIDs  []int  `json:"viewer_ids"`
}

// AuthorResponse is the lightweight, publicly-safe view of a post's creator
// embedded in a PostResponse.
type AuthorResponse struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	ProfilePhoto string `json:"profile_photo,omitempty"`
}

func toAuthorResponse(s users.Summary) AuthorResponse {
	return AuthorResponse{
		ID:           s.ID,
		Username:     s.Username,
		FirstName:    s.FirstName,
		LastName:     s.LastName,
		ProfilePhoto: s.ProfilePhoto,
	}
}

// PostResponse is the JSON-serializable view of a post returned to clients.
type PostResponse struct {
	ID         int            `json:"id"`
	UserID     int            `json:"user_id"`
	Author     AuthorResponse `json:"author"`
	Visibility string         `json:"visibility"`
	Title      string         `json:"title"`
	Content    string         `json:"content"`
	ImageURL   string         `json:"image_url,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	// IsOwner tells the client whether the requesting user owns this post,
	// so it knows whether to offer edit/delete actions.
	IsOwner bool `json:"is_owner"`
	// ViewerIDs is only populated for the owner of a custom-visibility post,
	// so an edit form can prefill the current allowed-viewer list.
	ViewerIDs []int `json:"viewer_ids,omitempty"`
}

func (h *Handler) newPostResponse(p *post, viewerID int, authors map[int]users.Summary) PostResponse {
	isOwner := p.User_ID == viewerID

	resp := PostResponse{
		ID:         p.ID,
		UserID:     p.User_ID,
		Visibility: p.visibility,
		Title:      p.Title,
		Content:    p.Content,
		CreatedAt:  p.Created_At,
		UpdatedAt:  p.Updated_At,
		IsOwner:    isOwner,
	}
	if author, ok := authors[p.User_ID]; ok {
		resp.Author = toAuthorResponse(author)
	}
	if p.ImagePath.Valid {
		resp.ImageURL = "/uploads/" + p.ImagePath.String
	}

	if isOwner && p.visibility == VisibilityCustom {
		if ids, err := h.service.GetAllowedViewerIDs(p.ID); err == nil {
			resp.ViewerIDs = ids
		}
	}

	return resp
}

// authorsFor batch-fetches the author Summary for every distinct post owner
// in posts, so a list of posts costs one users lookup instead of one per
// post.
func (h *Handler) authorsFor(posts []*post) map[int]users.Summary {
	ids := make([]int, 0, len(posts))
	seen := make(map[int]bool, len(posts))
	for _, p := range posts {
		if !seen[p.User_ID] {
			seen[p.User_ID] = true
			ids = append(ids, p.User_ID)
		}
	}

	authors, err := h.usersService.GetSummariesByIDs(ids)
	if err != nil {
		return map[int]users.Summary{}
	}
	return authors
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service, usersService *users.Service, mediaStorage *upload.MediaStorage, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		usersService:    usersService,
		mediaStorage:    mediaStorage,
		cookieName:      cookieName,
		cookieSecure:    cookieSecure,
		sessionLifetime: sessionLifetime,
	}
}

// NewPostHandler handles the creation of a new post.
// NewPostHandler expects a multipart/form-data body with "title", "content",
// and "visibility" ("public", "followers", or "custom") fields, a repeated
// "viewer_ids" field for each allowed viewer when visibility is "custom",
// plus an optional "image" file attachment (JPEG, PNG, GIF, or WebP).
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

	viewerIDs, err := parseViewerIDs(r.Form["viewer_ids"])
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	req := NewPostRequest{
		Title:      r.FormValue("title"),
		Content:    r.FormValue("content"),
		Visibility: r.FormValue("visibility"),
		ViewerIDs:  viewerIDs,
	}

	if err := ValidateNewPostRequest(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	imagePath, ok := h.saveImageAttachment(w, r)
	if !ok {
		return
	}

	p := &post{
		User_ID:    userID,
		visibility: req.Visibility,
		Title:      req.Title,
		Content:    req.Content,
		ImagePath:  sql.NullString{String: imagePath, Valid: imagePath != ""},
	}

	if err := h.service.CreatePost(p, req.ViewerIDs); err != nil {
		h.mediaStorage.Remove(imagePath)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(h.newPostResponse(p, userID, h.authorsFor([]*post{p})))
}

// saveImageAttachment reads the optional "image" form file from an
// already-parsed multipart request and stores it, returning its relative
// path (empty if no file was attached). On failure it writes the error
// response itself and returns ok=false.
func (h *Handler) saveImageAttachment(w http.ResponseWriter, r *http.Request) (imagePath string, ok bool) {
	file, header, err := r.FormFile("image")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return "", true
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid image upload"})
		return "", false
	}
	defer file.Close()

	imagePath, err = h.mediaStorage.Save(file, header)
	if err != nil {
		status := http.StatusBadRequest
		if !errors.Is(err, upload.ErrInvalidFileType) && !errors.Is(err, upload.ErrFileTooLarge) {
			status = http.StatusInternalServerError
		}
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return "", false
	}

	return imagePath, true
}

// GetPostByIDHandler retrieves a post by its ID.
// It expects the post ID to be provided as a path parameter.
// The user must be authenticated, and a post is only returned to viewers who
// can access it under its visibility setting - to anyone else it looks the
// same as one that doesn't exist.
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

	canAccess, err := h.service.canAccessPost(userID, p)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}
	if !canAccess {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(h.newPostResponse(p, userID, h.authorsFor([]*post{p})))
}

// ListPostsHandler returns up to 50 posts visible to the logged-in user,
// newest first. The optional "limit" query parameter requests fewer posts
// (capped at 50).
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

	authors := h.authorsFor(posts)
	res := make([]PostResponse, 0, len(posts))
	for _, p := range posts {
		res = append(res, h.newPostResponse(p, userID, authors))
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

// EditPostHandler handles editing a single post, identified by the {id}
// path segment. It is registered on its own PUT/PATCH routes, so the
// method is guaranteed by the router. viewer_ids replaces the post's
// allowed-viewer list when visibility is "custom"; it's ignored otherwise.
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

	if err := h.service.UpdatePost(userID, postID, req.Title, req.Content, req.Visibility, req.ViewerIDs); err != nil {
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

// parseViewerIDs converts repeated "viewer_ids" form values to ints.
func parseViewerIDs(raw []string) ([]int, error) {
	ids := make([]int, 0, len(raw))
	for _, v := range raw {
		id, err := strconv.Atoi(v)
		if err != nil {
			return nil, errors.New("viewer_ids must be integers")
		}
		ids = append(ids, id)
	}
	return ids, nil
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
