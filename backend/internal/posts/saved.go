package posts

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"social/internal/requestctx"
)

// Saved posts are private per-user bookmarks. They live in the posts package
// so that listing them can reuse the exact visibility check (canAccessPost)
// every other read path uses, instead of mirroring it in SQL.

// MaxListSavedPosts is the most saved posts one page will ever return.
const MaxListSavedPosts = 50

// savedRow is one bookmark joined to its post. savedID is the bookmark's own
// (monotonically increasing) id, used as the pagination cursor.
type savedRow struct {
	savedID int
	post    *post
}

// SavePost bookmarks postID for userID, provided userID can currently view
// it. A post the viewer can't see is reported as ErrPostNotFound - exactly
// like a post that doesn't exist - so saving can't be used to probe for
// private posts. Saving an already-saved post is a no-op.
func (s *Service) SavePost(userID, postID int) error {
	canAccess, err := s.CanAccess(userID, postID)
	if err != nil {
		return err
	}
	if !canAccess {
		return ErrPostNotFound
	}
	return s.repo.SavePost(userID, postID)
}

// UnsavePost removes userID's bookmark of postID. It deliberately does not
// check the post's visibility: a user must always be able to clear their own
// bookmark, and the call only ever touches their own row. Removing a
// bookmark that doesn't exist succeeds.
func (s *Service) UnsavePost(userID, postID int) error {
	return s.repo.UnsavePost(userID, postID)
}

// ListSavedPosts returns up to limit of userID's saved posts, most recently
// saved first, starting after the bookmark whose id is before (0 for the
// first page). Visibility is rechecked on every read, so a bookmark whose
// post was deleted, made private, or whose group the user left is skipped
// without exposing it. nextCursor is the cursor for the following page, or 0
// when there are no more accessible bookmarks.
func (s *Service) ListSavedPosts(userID, limit, before int) (page []*post, nextCursor int, err error) {
	if limit <= 0 || limit > MaxListSavedPosts {
		limit = MaxListSavedPosts
	}

	var lastSavedID int
	cursor := before
	for {
		rows, err := s.repo.ListSavedRows(userID, cursor, limit+1)
		if err != nil {
			return nil, 0, err
		}

		for _, row := range rows {
			cursor = row.savedID
			canAccess, err := s.canAccessPost(userID, row.post)
			if err != nil {
				return nil, 0, err
			}
			if !canAccess {
				continue
			}
			if len(page) == limit {
				// One accessible bookmark beyond the page proves there is a next page.
				if err := s.repo.loadMedia(page); err != nil {
					return nil, 0, err
				}
				return page, lastSavedID, nil
			}
			page = append(page, row.post)
			lastSavedID = row.savedID
		}

		if len(rows) < limit+1 {
			break
		}
	}

	if err := s.repo.loadMedia(page); err != nil {
		return nil, 0, err
	}
	return page, 0, nil
}

// SavedPostIDs reports which of posts userID has bookmarked.
func (s *Service) SavedPostIDs(userID int, posts []*post) (map[int]bool, error) {
	return s.repo.SavedPostIDs(userID, posts)
}

// SavePost records userID's bookmark of postID. Saving twice is a no-op: the
// unique (user_id, post_id) index absorbs the duplicate, and the original
// row (and so its place in the saved order) is kept.
func (r *Repository) SavePost(userID, postID int) error {
	_, err := r.db.Exec(`
		INSERT OR IGNORE INTO user_saved_posts (user_id, post_id, created_at)
		VALUES (?, ?, ?)
	`, userID, postID, time.Now())
	return err
}

// UnsavePost removes userID's bookmark of postID, if any.
func (r *Repository) UnsavePost(userID, postID int) error {
	_, err := r.db.Exec(`
		DELETE FROM user_saved_posts WHERE user_id = ? AND post_id = ?
	`, userID, postID)
	return err
}

// ListSavedRows returns up to limit of userID's bookmarks that are older than
// the bookmark with id before (all of them when before is 0), newest first.
// Ordering by the bookmark id is deterministic even when created_at repeats.
func (r *Repository) ListSavedRows(userID, before, limit int) ([]savedRow, error) {
	args := []any{userID}
	cursorClause := ""
	if before > 0 {
		cursorClause = "AND s.id < ?"
		args = append(args, before)
	}
	args = append(args, limit)

	rows, err := r.db.Query(`
		SELECT s.id, p.id, p.user_id, p.visibility, p.title, p.content, p.image_path, p.group_id, p.created_at, p.updated_at
		FROM user_saved_posts s
		JOIN posts p ON p.id = s.post_id
		WHERE s.user_id = ?
		`+cursorClause+`
		ORDER BY s.id DESC
		LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	saved := []savedRow{}
	for rows.Next() {
		var row savedRow
		var p post
		if err := rows.Scan(&row.savedID, &p.ID, &p.User_ID, &p.visibility, &p.Title, &p.Content, &p.ImagePath, &p.GroupID, &p.Created_At, &p.Updated_At); err != nil {
			return nil, err
		}
		row.post = &p
		saved = append(saved, row)
	}
	return saved, rows.Err()
}

// SavedPostIDs returns the set of ids among posts that userID has saved,
// using one query for the whole batch.
func (r *Repository) SavedPostIDs(userID int, posts []*post) (map[int]bool, error) {
	saved := make(map[int]bool, len(posts))
	if len(posts) == 0 {
		return saved, nil
	}

	placeholders := make([]string, 0, len(posts))
	args := make([]any, 0, len(posts)+1)
	args = append(args, userID)
	for _, p := range posts {
		placeholders = append(placeholders, "?")
		args = append(args, p.ID)
	}

	rows, err := r.db.Query(`
		SELECT post_id FROM user_saved_posts
		WHERE user_id = ? AND post_id IN (`+strings.Join(placeholders, ",")+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		saved[id] = true
	}
	return saved, rows.Err()
}

// savedFor looks up which of posts the viewer has bookmarked. The flag is a
// non-critical enhancement, so a lookup failure degrades to "not saved"
// instead of failing the whole response.
func (h *Handler) savedFor(viewerID int, posts []*post) map[int]bool {
	saved, err := h.service.SavedPostIDs(viewerID, posts)
	if err != nil {
		return map[int]bool{}
	}
	return saved
}

// SavedStatusResponse is returned by the save and unsave endpoints.
type SavedStatusResponse struct {
	PostID int  `json:"post_id"`
	Saved  bool `json:"saved"`
}

// SavedPostsResponse is one page of the viewer's saved posts, most recently
// saved first. NextCursor is omitted on the last page; pass it back as the
// "cursor" query parameter to fetch the next one.
type SavedPostsResponse struct {
	Posts      []PostResponse `json:"posts"`
	NextCursor *int           `json:"next_cursor,omitempty"`
}

// SavePostHandler bookmarks the post identified by the {id} path segment for
// the requesting user. It is idempotent: saving an already-saved post
// returns 200 again.
func (h *Handler) SavePostHandler(w http.ResponseWriter, r *http.Request) {
	h.setSaved(w, r, true)
}

// UnsavePostHandler removes the requesting user's bookmark of the post
// identified by the {id} path segment. It is idempotent: removing a bookmark
// that is already gone returns 200 again.
func (h *Handler) UnsavePostHandler(w http.ResponseWriter, r *http.Request) {
	h.setSaved(w, r, false)
}

func (h *Handler) setSaved(w http.ResponseWriter, r *http.Request, save bool) {
	userID, ok := requestUserID(w, r)
	if !ok {
		return
	}

	postID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || postID <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Invalid post id"})
		return
	}

	if save {
		err = h.service.SavePost(userID, postID)
	} else {
		err = h.service.UnsavePost(userID, postID)
	}
	if err != nil {
		writePostError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SavedStatusResponse{PostID: postID, Saved: save})
}

// ListSavedPostsHandler returns the requesting user's saved posts, most
// recently saved first. The identity always comes from the session, never
// from the request. The optional "limit" query parameter requests fewer posts
// (capped at 50) and "cursor" continues from a previous page's next_cursor.
func (h *Handler) ListSavedPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requestUserID(w, r)
	if !ok {
		return
	}

	limit := MaxListSavedPosts
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Response{Error: "Invalid limit"})
			return
		}
		limit = parsed
	}

	cursor := 0
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Response{Error: "Invalid cursor"})
			return
		}
		cursor = parsed
	}

	posts, nextCursor, err := h.service.ListSavedPosts(userID, limit, cursor)
	if err != nil {
		writePostError(w, err)
		return
	}

	authors := h.authorsFor(posts)
	groupTitles := h.groupTitlesFor(posts)
	// Everything in this list is saved by definition.
	saved := make(map[int]bool, len(posts))
	for _, p := range posts {
		saved[p.ID] = true
	}

	res := SavedPostsResponse{Posts: make([]PostResponse, 0, len(posts))}
	for _, p := range posts {
		res.Posts = append(res.Posts, h.newPostResponse(p, userID, authors, groupTitles, saved))
	}
	if nextCursor > 0 {
		res.NextCursor = &nextCursor
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

func requestUserID(w http.ResponseWriter, r *http.Request) (int, bool) {
	userID, ok := requestctx.UserID(r.Context())
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Response{Error: "Not logged in"})
		return 0, false
	}
	return userID, true
}
