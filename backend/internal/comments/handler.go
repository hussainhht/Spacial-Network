package comments

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"social/internal/groups"
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/upload"
)

// maxNewCommentRequestSize bounds the total size of a create-comment
// request (form fields plus the optional image attachment).
const maxNewCommentRequestSize = 8 << 20 // 8 MiB

type Handler struct {
	service      *Service
	mediaStorage *upload.MediaStorage
}

type Response struct {
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// CommentResponse is the JSON-serializable view of a comment returned to
// clients.
type CommentResponse struct {
	ID        int       `json:"id"`
	PostID    int       `json:"post_id"`
	UserID    int       `json:"user_id"`
	Content   string    `json:"content"`
	ImageURL  string    `json:"image_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// IsOwner tells the client whether the requesting user owns this
	// comment, so it knows whether to offer a delete action.
	IsOwner bool `json:"is_owner"`
	// CanDelete tells the client whether the requesting user may delete
	// this comment - true for the author, and also for the creator of the
	// group its post belongs to.
	CanDelete bool `json:"can_delete"`
}

// newCommentResponse builds the response for c as seen by viewerID.
// isModerator is whether viewerID is the creator of the group c's post
// belongs to (irrelevant, and safe to pass false, when c is owned by
// viewerID) - callers rendering a whole list should look it up once via
// Service.IsGroupModerator and pass the same value for every comment on
// that post, rather than re-checking per comment.
func (h *Handler) newCommentResponse(c *comment, viewerID int, isModerator bool) CommentResponse {
	isOwner := c.UserID == viewerID
	canDelete := isOwner || isModerator

	resp := CommentResponse{
		ID:        c.ID,
		PostID:    c.PostID,
		UserID:    c.UserID,
		Content:   c.Content,
		CreatedAt: c.Created_At,
		UpdatedAt: c.Updated_At,
		IsOwner:   isOwner,
		CanDelete: canDelete,
	}
	if c.ImagePath.Valid {
		resp.ImageURL = "/uploads/" + c.ImagePath.String
	}
	return resp
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service, mediaStorage *upload.MediaStorage) *Handler {
	return &Handler{
		service:      service,
		mediaStorage: mediaStorage,
	}
}

// NewCommentHandler creates a comment on the post identified by the {id}
// path segment. It expects a multipart/form-data body with a "content"
// field and an optional "image" file attachment (JPEG, PNG, GIF, or WebP).
// The user must be able to view the post to comment on it.
func (h *Handler) NewCommentHandler(w http.ResponseWriter, r *http.Request) {
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

	r.Body = http.MaxBytesReader(w, r.Body, maxNewCommentRequestSize)
	if err := r.ParseMultipartForm(maxNewCommentRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request payload or body"})
		return
	}

	content, err := ValidateContent(r.FormValue("content"))
	if err != nil {
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

	c, err := h.service.CreateComment(userID, postID, content, sql.NullString{String: imagePath, Valid: imagePath != ""})
	if err != nil {
		h.mediaStorage.Remove(imagePath)
		writeCommentError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	// A freshly created comment is always owned by userID, so moderator
	// status can't affect can_delete here.
	json.NewEncoder(w).Encode(h.newCommentResponse(c, userID, false))
}

// ListCommentsHandler returns every comment on the post identified by the
// {id} path segment, oldest first.
func (h *Handler) ListCommentsHandler(w http.ResponseWriter, r *http.Request) {
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

	list, err := h.service.ListComments(userID, postID)
	if err != nil {
		writeCommentError(w, err)
		return
	}

	// Looked up once and reused for every comment below, instead of
	// re-fetching the (shared) post per comment.
	isModerator, err := h.service.IsGroupModerator(userID, postID)
	if err != nil {
		isModerator = false
	}

	res := make([]CommentResponse, 0, len(list))
	for _, c := range list {
		res = append(res, h.newCommentResponse(c, userID, isModerator))
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

// CommentCountResponse is the JSON-serializable view of a post's comment
// count.
type CommentCountResponse struct {
	PostID int `json:"post_id"`
	Count  int `json:"count"`
}

// GetCommentCountHandler returns how many comments exist on the post
// identified by the {id} path segment.
func (h *Handler) GetCommentCountHandler(w http.ResponseWriter, r *http.Request) {
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

	count, err := h.service.CountComments(userID, postID)
	if err != nil {
		writeCommentError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(CommentCountResponse{PostID: postID, Count: count})
}

// DeleteCommentHandler deletes the comment identified by the {commentID}
// path segment. Only the comment's author may delete it.
func (h *Handler) DeleteCommentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	commentID, err := strconv.Atoi(r.PathValue("commentID"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid comment id"})
		return
	}

	if err := h.service.DeleteComment(userID, commentID); err != nil {
		writeCommentError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Message: "Comment deleted"})
}

// writeCommentError maps a service error to the appropriate HTTP status
// code and writes the JSON error response.
func writeCommentError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPostNotFound), errors.Is(err, posts.ErrPostNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
	case errors.Is(err, ErrCommentNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Comment not found"})
	case errors.Is(err, ErrForbidden):
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(Response{Error: "Not allowed to modify this comment"})
	case errors.Is(err, groups.ErrNotGroupMember):
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(Response{Error: "You must be a member of this group to comment"})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
	}
}
