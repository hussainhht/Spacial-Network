// Package likes_test covers social/internal/likes: liking and unliking a
// post, idempotency of a repeated like, the returned count/liked status,
// and permission checks (post must exist and be visible; group posts
// require membership) via the HTTP handler layer, since the like type is
// unexported.
package likes_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"social/internal/followers"
	"social/internal/groups"
	"social/internal/likes"
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db           *sql.DB
	postsHandler *posts.Handler
	groupsSvc    *groups.Service
	likesHandler *likes.Handler
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo, nil, nil)

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, followersSvc)

	groupsRepo := groups.NewRepository(db)
	groupsSvc := groups.NewService(groupsRepo, nil, websocket.NewHub())

	postsRepo := posts.NewRepository(db)
	postsSvc := posts.NewService(postsRepo, followersSvc, groupsSvc)

	postMedia, err := upload.NewMediaStorage(t.TempDir(), upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage(posts): %v", err)
	}
	postsHandler := posts.NewHandler(postsSvc, usersSvc, groupsSvc, postMedia, "session_token", false, 0)

	likesRepo := likes.NewRepository(db)
	likesSvc := likes.NewService(likesRepo, postsSvc)
	likesHandler := likes.NewHandler(likesSvc)

	return fixture{db: db, postsHandler: postsHandler, groupsSvc: groupsSvc, likesHandler: likesHandler}
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

func (f fixture) newPublicPost(t *testing.T, authorID int) int {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("title", "A post")
	w.WriteField("content", "Some content")
	w.WriteField("visibility", posts.VisibilityPublic)
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req = req.WithContext(requestctx.WithUserID(req.Context(), authorID))
	rr := httptest.NewRecorder()
	f.postsHandler.NewPostHandler(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create post: status=%d body=%s", rr.Code, rr.Body.String())
	}

	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal post: %v", err)
	}
	return resp.ID
}

// newGroupPost creates groupID (owned by creatorID) and a post inside it,
// returning the post's id.
func (f fixture) newGroupPost(t *testing.T, creatorID int) int {
	t.Helper()

	groupID, err := f.groupsSvc.CreateGroup(creatorID, "A group", "desc", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("title", "Group post")
	w.WriteField("content", "Group content")
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/groups/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.SetPathValue("id", strconv.FormatInt(groupID, 10))
	req = req.WithContext(requestctx.WithUserID(req.Context(), creatorID))
	rr := httptest.NewRecorder()
	f.postsHandler.NewGroupPostHandler(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create group post: status=%d body=%s", rr.Code, rr.Body.String())
	}

	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal group post: %v", err)
	}
	return resp.ID
}

func likeRequest(t *testing.T, method string, userID, postID int) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, "/api/posts/likes", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	return req
}

func decodeStatus(t *testing.T, rr *httptest.ResponseRecorder) likes.LikeStatusResponse {
	t.Helper()
	var resp likes.LikeStatusResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal like status: %v (body=%s)", err, rr.Body.String())
	}
	return resp
}

func TestLikePost_RecordsLikeAndReturnsStatus(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor")
	liker := f.newUser(t, "liker")
	postID := f.newPublicPost(t, author)

	req := likeRequest(t, http.MethodPost, liker, postID)
	rr := httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	resp := decodeStatus(t, rr)
	if resp.PostID != postID {
		t.Errorf("PostID = %d, want %d", resp.PostID, postID)
	}
	if !resp.Liked {
		t.Error("Liked = false, want true")
	}
	if resp.Count != 1 {
		t.Errorf("Count = %d, want 1", resp.Count)
	}
}

func TestLikePost_IsIdempotent(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor2")
	liker := f.newUser(t, "liker2")
	postID := f.newPublicPost(t, author)

	for i := 0; i < 2; i++ {
		req := likeRequest(t, http.MethodPost, liker, postID)
		rr := httptest.NewRecorder()
		f.likesHandler.LikePostHandler(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("like #%d: status = %d, want %d; body=%s", i+1, rr.Code, http.StatusOK, rr.Body.String())
		}
	}

	req := likeRequest(t, http.MethodGet, liker, postID)
	rr := httptest.NewRecorder()
	f.likesHandler.GetLikeStatusHandler(rr, req)
	resp := decodeStatus(t, rr)
	if resp.Count != 1 {
		t.Errorf("Count after double like = %d, want 1", resp.Count)
	}
}

func TestUnlikePost_RemovesLike(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor3")
	liker := f.newUser(t, "liker3")
	postID := f.newPublicPost(t, author)

	rr := httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, likeRequest(t, http.MethodPost, liker, postID))
	if rr.Code != http.StatusOK {
		t.Fatalf("like: status = %d, body=%s", rr.Code, rr.Body.String())
	}

	rr = httptest.NewRecorder()
	f.likesHandler.UnlikePostHandler(rr, likeRequest(t, http.MethodDelete, liker, postID))
	if rr.Code != http.StatusOK {
		t.Fatalf("unlike: status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	resp := decodeStatus(t, rr)
	if resp.Liked {
		t.Error("Liked = true after unlike, want false")
	}
	if resp.Count != 0 {
		t.Errorf("Count after unlike = %d, want 0", resp.Count)
	}
}

func TestUnlikePost_NeverLiked_Returns404(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor4")
	otherUser := f.newUser(t, "notaliker")
	postID := f.newPublicPost(t, author)

	rr := httptest.NewRecorder()
	f.likesHandler.UnlikePostHandler(rr, likeRequest(t, http.MethodDelete, otherUser, postID))

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNotFound, rr.Body.String())
	}
}

func TestGetLikeStatus_CountsMultipleLikersAndReflectsViewer(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor5")
	likerA := f.newUser(t, "likerA")
	likerB := f.newUser(t, "likerB")
	viewerOnly := f.newUser(t, "vieweronly")
	postID := f.newPublicPost(t, author)

	for _, liker := range []int{likerA, likerB} {
		rr := httptest.NewRecorder()
		f.likesHandler.LikePostHandler(rr, likeRequest(t, http.MethodPost, liker, postID))
		if rr.Code != http.StatusOK {
			t.Fatalf("like by %d: status = %d, body=%s", liker, rr.Code, rr.Body.String())
		}
	}

	rr := httptest.NewRecorder()
	f.likesHandler.GetLikeStatusHandler(rr, likeRequest(t, http.MethodGet, likerA, postID))
	resp := decodeStatus(t, rr)
	if resp.Count != 2 {
		t.Errorf("Count = %d, want 2", resp.Count)
	}
	if !resp.Liked {
		t.Error("Liked for likerA = false, want true")
	}

	rr = httptest.NewRecorder()
	f.likesHandler.GetLikeStatusHandler(rr, likeRequest(t, http.MethodGet, viewerOnly, postID))
	resp = decodeStatus(t, rr)
	if resp.Count != 2 {
		t.Errorf("Count seen by non-liker = %d, want 2", resp.Count)
	}
	if resp.Liked {
		t.Error("Liked for viewerOnly = true, want false")
	}
}

func TestLikePost_NonExistentPost_Returns404(t *testing.T) {
	f := setup(t)
	liker := f.newUser(t, "liker6")

	rr := httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, likeRequest(t, http.MethodPost, liker, 999999))

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNotFound, rr.Body.String())
	}
}

func TestLikePost_GroupPost_RequiresMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "groupcreator")
	outsider := f.newUser(t, "outsider")
	postID := f.newGroupPost(t, creator)

	rr := httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, likeRequest(t, http.MethodPost, outsider, postID))

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusForbidden, rr.Body.String())
	}

	// The creator (a member by construction) can still like their own
	// group's post.
	rr = httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, likeRequest(t, http.MethodPost, creator, postID))
	if rr.Code != http.StatusOK {
		t.Fatalf("creator like: status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
}

func TestLikePost_Unauthenticated_Returns401(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor7")
	postID := f.newPublicPost(t, author)

	req := httptest.NewRequest(http.MethodPost, "/api/posts/likes", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	f.likesHandler.LikePostHandler(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnauthorized, rr.Body.String())
	}
}
