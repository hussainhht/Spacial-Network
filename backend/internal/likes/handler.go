package likes

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"social/internal/groups"
	"social/internal/posts"
	"social/internal/requestctx"
)

type Handler struct {
	service *Service
}

type Response struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// LikeStatusResponse is the JSON-serializable view of a post's like state
// as seen by the requesting user.
type LikeStatusResponse struct {
	PostID int `json:"post_id"`
	// Count is the post's total number of likes.
	Count int `json:"count"`
	// Liked tells the client whether the requesting user has liked this
	// post, so it knows whether to render the button as active and whether
	// a tap should like or unlike.
	Liked bool `json:"liked"`
}

// newLikeStatusResponse builds the response for status.
func (h *Handler) newLikeStatusResponse(status *LikeStatus) LikeStatusResponse {
	return LikeStatusResponse{
		PostID: status.PostID,
		Count:  status.Count,
		Liked:  status.Liked,
	}
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// LikePostHandler likes the post identified by the {id} path segment on
// behalf of the requesting user, and responds with the post's resulting
// like state. Liking a post that is already liked is a no-op and still
// returns 200 - the endpoint is idempotent, so a double-tap or a retried
// request can't inflate the count.
func (h *Handler) LikePostHandler(w http.ResponseWriter, r *http.Request) {
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

	status, err := h.service.LikePost(userID, postID)
	if err != nil {
		writeLikeError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(h.newLikeStatusResponse(status))
}

// UnlikePostHandler removes the requesting user's like of the post
// identified by the {id} path segment, and responds with the post's
// resulting like state.
func (h *Handler) UnlikePostHandler(w http.ResponseWriter, r *http.Request) {
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

	status, err := h.service.UnlikePost(userID, postID)
	if err != nil {
		writeLikeError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(h.newLikeStatusResponse(status))
}

// GetLikeStatusHandler returns the like count for the post identified by
// the {id} path segment, together with whether the requesting user has
// liked it.
func (h *Handler) GetLikeStatusHandler(w http.ResponseWriter, r *http.Request) {
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

	status, err := h.service.GetStatus(userID, postID)
	if err != nil {
		writeLikeError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(h.newLikeStatusResponse(status))
}

// writeLikeError maps a service error to the appropriate HTTP status code
// and writes the JSON error response.
func writeLikeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPostNotFound), errors.Is(err, posts.ErrPostNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
	case errors.Is(err, ErrLikeNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Like not found"})
	case errors.Is(err, groups.ErrNotGroupMember):
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(Response{Error: "You must be a member of this group to like this post"})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
	}
}
