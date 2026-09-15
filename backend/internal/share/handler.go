package share

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

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

// ShareResponse is returned when a share has been accepted for delivery.
// It echoes the in-site link that was sent so the client can show what
// went out without recomposing it.
type ShareResponse struct {
	PostID int    `json:"post_id"`
	Target string `json:"target"`
	// Link is the relative in-site path that was messaged.
	Link string `json:"link"`
}

// NewHandler creates a new Handler instance with the provided dependencies.
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// SharePostHandler shares the post identified by the {id} path segment as
// an in-site chat message. It expects a JSON body naming the destination:
//
//	{"target": "user",  "target_id": 12, "message": "look at this"}
//	{"target": "group", "target_id": 3}
//
// The user must be able to view the post to share it, and chat's own
// rules decide whether they may message the recipient.
func (h *Handler) SharePostHandler(w http.ResponseWriter, r *http.Request) {
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

	var req ShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request payload or body"})
		return
	}

	target, err := ValidateTarget(req.Target)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	targetID, err := ValidateTargetID(req.TargetID)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	note, err := ValidateNote(req.Message)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	if err := h.service.SharePost(userID, postID, target, targetID, note); err != nil {
		writeShareError(w, err)
		return
	}

	// 202, not 201: chat owns delivery from here, and reports a rejected
	// recipient to the sender over the WebSocket error channel rather
	// than in this response.
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(ShareResponse{
		PostID: postID,
		Target: target,
		Link:   PostLink(postID),
	})
}

// writeShareError maps a service error to the appropriate HTTP status
// code and writes the JSON error response. Request validation is handled
// by the caller above, so anything reaching here is either an access
// failure or a genuine server fault.
func writeShareError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPostNotFound), errors.Is(err, posts.ErrPostNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Post not found"})
	case errors.Is(err, ErrInvalidTarget), errors.Is(err, ErrInvalidTargetID):
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
	}
}
