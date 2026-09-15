package posts

import (
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"social/internal/groups"
	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
)

const (
	// MaxPostMedia is the product limit shared with the create-post UI.
	MaxPostMedia          = 4
	maxNewPostRequestSize = 24 << 20 // four 5 MiB files plus multipart overhead
)

type Handler struct {
	service         *Service
	usersService    *users.Service
	groupsService   *groups.Service
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
	ID         int             `json:"id"`
	UserID     int             `json:"user_id"`
	Author     AuthorResponse  `json:"author"`
	Visibility string          `json:"visibility"`
	Title      string          `json:"title"`
	Content    string          `json:"content"`
	ImageURL   string          `json:"image_url,omitempty"`
	Media      []MediaResponse `json:"media"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	// IsOwner tells the client whether the requesting user owns this post,
	// so it knows whether to offer an edit action.
	IsOwner bool `json:"is_owner"`
	// CanDelete tells the client whether the requesting user may delete
	// this post - true for the owner, and also for the creator of the
	// group it was posted in.
	CanDelete bool `json:"can_delete"`
	// GroupID is set when this post was created within a group.
	GroupID *int `json:"group_id,omitempty"`
	// GroupTitle is exposed with group posts so clients can show useful
	// navigation context without issuing a request per card.
	GroupTitle string `json:"group_title,omitempty"`
	// AuthorLeftGroup is only set on a group post whose author is no
	// longer a member of that group.
	AuthorLeftGroup bool `json:"author_left_group,omitempty"`
	// ViewerIDs is only populated for the owner of a custom-visibility post,
	// so an edit form can prefill the current allowed-viewer list.
	ViewerIDs []int `json:"viewer_ids,omitempty"`
}

// MediaResponse is an ordered post attachment. Type is "gif" for animated
// GIFs and "image" for all supported still-image formats.
type MediaResponse struct {
	ID    int    `json:"id"`
	URL   string `json:"url"`
	Type  string `json:"type"`
	Order int    `json:"order"`
}

func (h *Handler) newPostResponse(p *post, viewerID int, authors map[int]users.Summary, groupTitles map[int]string) PostResponse {
	isOwner := p.User_ID == viewerID

	canDelete := isOwner
	if !canDelete {
		canDelete, _ = h.service.canModerate(viewerID, p)
	}

	resp := PostResponse{
		ID:         p.ID,
		UserID:     p.User_ID,
		Visibility: p.visibility,
		Title:      p.Title,
		Content:    p.Content,
		CreatedAt:  p.Created_At,
		UpdatedAt:  p.Updated_At,
		IsOwner:    isOwner,
		CanDelete:  canDelete,
		Media:      make([]MediaResponse, 0, len(p.Media)),
	}
	if author, ok := authors[p.User_ID]; ok {
		resp.Author = toAuthorResponse(author)
	}
	for _, media := range p.Media {
		resp.Media = append(resp.Media, MediaResponse{
			ID: media.ID, URL: "/uploads/" + media.FilePath,
			Type: media.MediaType, Order: media.SortOrder,
		})
	}
	if len(resp.Media) > 0 {
		resp.ImageURL = resp.Media[0].URL
	}

	if p.GroupID.Valid {
		groupID := int(p.GroupID.Int64)
		resp.GroupID = &groupID
		resp.GroupTitle = groupTitles[groupID]
		if isMember, err := h.groupsService.IsGroupMember(groupID, p.User_ID); err == nil && !isMember {
			resp.AuthorLeftGroup = true
		}
	}

	if isOwner && p.visibility == VisibilityCustom {
		if ids, err := h.service.GetAllowedViewerIDs(p.ID); err == nil {
			resp.ViewerIDs = ids
		}
	}

	return resp
}

// groupTitlesFor fetches each referenced group at most once for a response
// batch. It keeps the frontend's context labels useful without introducing a
// client request or a repeated group lookup for every card in the same group.
func (h *Handler) groupTitlesFor(posts []*post) map[int]string {
	titles := make(map[int]string)
	for _, p := range posts {
		if !p.GroupID.Valid {
			continue
		}
		groupID := int(p.GroupID.Int64)
		if _, seen := titles[groupID]; seen {
			continue
		}
		if group, err := h.groupsService.GetGroupByID(groupID); err == nil {
			titles[groupID] = group.Title
		} else {
			titles[groupID] = ""
		}
	}
	return titles
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
func NewHandler(service *Service, usersService *users.Service, groupsService *groups.Service, mediaStorage *upload.MediaStorage, cookieName string, cookieSecure bool, sessionLifetime time.Duration) *Handler {
	return &Handler{
		service:         service,
		usersService:    usersService,
		groupsService:   groupsService,
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
// plus up to MaxPostMedia repeated "media" file attachments. The legacy
// singular "image" field remains accepted for older clients.
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

	media, ok := h.saveMediaAttachments(w, r)
	if !ok {
		return
	}

	p := &post{
		User_ID:    userID,
		visibility: req.Visibility,
		Title:      req.Title,
		Content:    req.Content,
		Media:      media,
	}

	if err := h.service.CreatePost(p, req.ViewerIDs); err != nil {
		h.removeMedia(media)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(h.newPostResponse(p, userID, h.authorsFor([]*post{p}), h.groupTitlesFor([]*post{p})))
}

// NewGroupPostHandler creates a post within the group identified by the
// {id} path segment, on behalf of the authenticated user. It expects a
// multipart/form-data body with "title" and "content" fields, plus an
// optional "image" file attachment. Only current members of the group may
// post to it.
func (h *Handler) NewGroupPostHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	groupID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid group id"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxNewPostRequestSize)
	if err := r.ParseMultipartForm(maxNewPostRequestSize); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid request payload or body"})
		return
	}

	title, err := ValidateTitle(r.FormValue("title"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	content, err := ValidateContent(r.FormValue("content"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	media, ok := h.saveMediaAttachments(w, r)
	if !ok {
		return
	}

	p := &post{
		User_ID: userID,
		Title:   title,
		Content: content,
		Media:   media,
	}

	if err := h.service.CreateGroupPost(p, groupID); err != nil {
		h.removeMedia(media)
		writePostError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(h.newPostResponse(p, userID, h.authorsFor([]*post{p}), h.groupTitlesFor([]*post{p})))
}

// saveMediaAttachments validates and stores repeated media fields in request
// order. If any file fails, every file written by this request is removed.
func (h *Handler) saveMediaAttachments(w http.ResponseWriter, r *http.Request) ([]postMedia, bool) {
	files := r.MultipartForm.File["media"]
	files = append(files, r.MultipartForm.File["image"]...)
	if len(files) > MaxPostMedia {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "A post can include up to 4 media items"})
		return nil, false
	}

	media := make([]postMedia, 0, len(files))
	for i, header := range files {
		file, err := header.Open()
		if err != nil {
			h.removeMedia(media)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Response{Error: "Invalid media upload"})
			return nil, false
		}

		path, saveErr := h.mediaStorage.Save(file, header)
		file.Close()
		if saveErr != nil {
			h.removeMedia(media)
			status := http.StatusBadRequest
			if !errors.Is(saveErr, upload.ErrInvalidFileType) && !errors.Is(saveErr, upload.ErrFileTooLarge) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(Response{Error: saveErr.Error()})
			return nil, false
		}

		kind := "image"
		if strings.EqualFold(filepath.Ext(path), ".gif") {
			kind = "gif"
		}
		media = append(media, postMedia{FilePath: path, MediaType: kind, SortOrder: i})
	}

	return media, true
}

func (h *Handler) removeMedia(media []postMedia) {
	for _, item := range media {
		_ = h.mediaStorage.Remove(item.FilePath)
	}
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
	json.NewEncoder(w).Encode(h.newPostResponse(p, userID, h.authorsFor([]*post{p}), h.groupTitlesFor([]*post{p})))
}

// ListPostsHandler returns up to 50 posts visible to the logged-in user,
// newest first. The optional "limit" query parameter requests fewer posts
// (capped at 50). The optional "feed" query parameter narrows the result to
// an author scope - "all" (default), "following", or "friends" - while
// still applying the normal post-visibility rules; an unrecognized value
// is rejected with 400.
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

	feed, err := ValidateFeedScope(r.URL.Query().Get("feed"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	var cursor *FeedCursor
	before := r.URL.Query().Get("before")
	beforeID := r.URL.Query().Get("before_id")
	if before != "" || beforeID != "" {
		createdAt, timeErr := time.Parse(time.RFC3339Nano, before)
		id, idErr := strconv.Atoi(beforeID)
		if timeErr != nil || idErr != nil || id <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Response{Error: "Invalid feed cursor"})
			return
		}
		cursor = &FeedCursor{CreatedAt: createdAt, ID: id}
	}

	posts, err := h.service.ListPostsPage(userID, limit, feed, cursor)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
		return
	}

	authors := h.authorsFor(posts)
	groupTitles := h.groupTitlesFor(posts)
	res := make([]PostResponse, 0, len(posts))
	for _, p := range posts {
		res = append(res, h.newPostResponse(p, userID, authors, groupTitles))
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

// ListGroupPostsHandler returns up to 50 posts belonging to the group
// identified by the {id} path segment, newest first. Group posts remain
// member-only regardless of whether joining the group is public or private.
// The optional "limit" query parameter requests fewer posts (capped at 50).
func (h *Handler) ListGroupPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return
	}

	groupID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid group id"})
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

	posts, err := h.service.ListGroupPosts(groupID, userID, limit)
	if err != nil {
		writePostError(w, err)
		return
	}

	authors := h.authorsFor(posts)
	groupTitles := h.groupTitlesFor(posts)
	res := make([]PostResponse, 0, len(posts))
	for _, p := range posts {
		res = append(res, h.newPostResponse(p, userID, authors, groupTitles))
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

	p, err := h.service.GetPostByID(postID)
	if err != nil {
		writePostError(w, err)
		return
	}

	if err := h.service.DeletePost(userID, postID); err != nil {
		writePostError(w, err)
		return
	}
	h.removeMedia(p.Media)

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
	case errors.Is(err, groups.ErrGroupNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Group not found"})
	case errors.Is(err, groups.ErrNotGroupMember):
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(Response{Error: "You must be a member of this group to do this"})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: "Server error"})
	}
}
