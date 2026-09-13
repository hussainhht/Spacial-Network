// Package posts_test covers social/internal/posts: creating posts at each
// privacy level (public, followers-only "almost-private", and custom
// "private" with an explicit allowed-viewer list) and the resulting
// visibility rules. The post struct itself is unexported, so posts are
// created and inspected through the HTTP handler (NewPostHandler) and the
// exported Service.CanAccess/CanCreateComment methods, exactly as the real
// API is used.
package posts_test

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
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db           *sql.DB
	postsSvc     *posts.Service
	postsHandler *posts.Handler
	followersSvc *followers.Service
	usersSvc     *users.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo, nil)

	usersRepo := users.NewRepository(db)
	usersSvc := users.NewService(usersRepo, followersSvc)

	groupsRepo := groups.NewRepository(db)
	groupsSvc := groups.NewService(groupsRepo, nil, websocket.NewHub())

	postsRepo := posts.NewRepository(db)
	postsSvc := posts.NewService(postsRepo, followersSvc, groupsSvc)

	mediaStorage, err := upload.NewMediaStorage(t.TempDir(), upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage: %v", err)
	}

	handler := posts.NewHandler(postsSvc, usersSvc, groupsSvc, mediaStorage, "session_token", false, 0)

	return fixture{db: db, postsSvc: postsSvc, postsHandler: handler, followersSvc: followersSvc, usersSvc: usersSvc}
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

// newPostRequest builds a multipart/form-data POST request for
// NewPostHandler, optionally attaching image bytes as a file.
func newPostRequest(t *testing.T, userID int, title, content, visibility string, viewerIDs []int, imageName string, imageBytes []byte) *http.Request {
	t.Helper()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("build multipart request: %v", err)
		}
	}
	must(w.WriteField("title", title))
	must(w.WriteField("content", content))
	must(w.WriteField("visibility", visibility))
	for _, id := range viewerIDs {
		must(w.WriteField("viewer_ids", strconv.Itoa(id)))
	}
	if imageName != "" {
		part, err := w.CreateFormFile("image", imageName)
		must(err)
		_, err = part.Write(imageBytes)
		must(err)
	}
	must(w.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	return req
}

func createPost(t *testing.T, f fixture, userID int, title, content, visibility string, viewerIDs []int) posts.PostResponse {
	t.Helper()
	req := newPostRequest(t, userID, title, content, visibility, viewerIDs, "", nil)
	rr := httptest.NewRecorder()
	f.postsHandler.NewPostHandler(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("create post status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal post response: %v", err)
	}
	return resp
}

func TestCreatePost_PublicVisibility_StoresCorrectPrivacy(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "pubauthor")

	resp := createPost(t, f, author, "Hello", "World", posts.VisibilityPublic, nil)
	if resp.Visibility != posts.VisibilityPublic {
		t.Errorf("visibility = %q, want %q", resp.Visibility, posts.VisibilityPublic)
	}
}

func TestCreatePost_FollowersVisibility_StoresCorrectPrivacy(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "folauthor")

	resp := createPost(t, f, author, "Hello", "Followers only", posts.VisibilityFollowers, nil)
	if resp.Visibility != posts.VisibilityFollowers {
		t.Errorf("visibility = %q, want %q", resp.Visibility, posts.VisibilityFollowers)
	}
}

func TestCreatePost_CustomVisibility_StoresAllowedViewers(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "customauthor")
	followerA := f.newUser(t, "followerA")
	followerB := f.newUser(t, "followerB")
	nonFollower := f.newUser(t, "nonfollower")

	if err := f.followersSvc.FollowUser(followerA, author); err != nil {
		t.Fatalf("FollowUser A: %v", err)
	}
	if err := f.followersSvc.FollowUser(followerB, author); err != nil {
		t.Fatalf("FollowUser B: %v", err)
	}

	resp := createPost(t, f, author, "Hello", "Just for some", posts.VisibilityCustom, []int{followerA, followerB, nonFollower})
	if resp.Visibility != posts.VisibilityCustom {
		t.Errorf("visibility = %q, want %q", resp.Visibility, posts.VisibilityCustom)
	}

	// Only actual followers make it onto the allowed-viewer list, even
	// though a non-follower ID was requested.
	got := map[int]bool{}
	for _, id := range resp.ViewerIDs {
		got[id] = true
	}
	if len(got) != 2 || !got[followerA] || !got[followerB] {
		t.Errorf("allowed viewer ids = %v, want exactly [%d %d]", resp.ViewerIDs, followerA, followerB)
	}
	if got[nonFollower] {
		t.Errorf("non-follower %d must not be granted access via viewer_ids", nonFollower)
	}
}

func TestPostVisibility_Public_VisibleToAnyUser(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "pub2")
	stranger := f.newUser(t, "pub2stranger")

	resp := createPost(t, f, author, "T", "C", posts.VisibilityPublic, nil)

	canAccess, err := f.postsSvc.CanAccess(stranger, resp.ID)
	if err != nil {
		t.Fatalf("CanAccess: %v", err)
	}
	if !canAccess {
		t.Errorf("public post must be visible to any user")
	}
}

func TestPostVisibility_Followers_OnlyVisibleToFollowers(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "fol2")
	follower := f.newUser(t, "fol2follower")
	stranger := f.newUser(t, "fol2stranger")

	if err := f.followersSvc.FollowUser(follower, author); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	resp := createPost(t, f, author, "T", "C", posts.VisibilityFollowers, nil)

	canFollowerAccess, err := f.postsSvc.CanAccess(follower, resp.ID)
	if err != nil {
		t.Fatalf("CanAccess(follower): %v", err)
	}
	if !canFollowerAccess {
		t.Errorf("a follower must be able to view a followers-only post")
	}

	canStrangerAccess, err := f.postsSvc.CanAccess(stranger, resp.ID)
	if err != nil {
		t.Fatalf("CanAccess(stranger): %v", err)
	}
	if canStrangerAccess {
		t.Errorf("a non-follower must not be able to view a followers-only post")
	}
}

func TestPostVisibility_Custom_OnlyVisibleToSelectedUsers(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "cus2")
	selected := f.newUser(t, "cus2selected")
	notSelected := f.newUser(t, "cus2notselected")

	if err := f.followersSvc.FollowUser(selected, author); err != nil {
		t.Fatalf("FollowUser selected: %v", err)
	}
	if err := f.followersSvc.FollowUser(notSelected, author); err != nil {
		t.Fatalf("FollowUser notSelected: %v", err)
	}

	resp := createPost(t, f, author, "T", "C", posts.VisibilityCustom, []int{selected})

	canSelectedAccess, err := f.postsSvc.CanAccess(selected, resp.ID)
	if err != nil {
		t.Fatalf("CanAccess(selected): %v", err)
	}
	if !canSelectedAccess {
		t.Errorf("a user on the allowed-viewer list must be able to view a custom-visibility post")
	}

	canNotSelectedAccess, err := f.postsSvc.CanAccess(notSelected, resp.ID)
	if err != nil {
		t.Fatalf("CanAccess(notSelected): %v", err)
	}
	if canNotSelectedAccess {
		t.Errorf("a follower not on the allowed-viewer list must not be able to view a custom-visibility post")
	}
}

func TestListPosts_IncludesOwnPostsRegardlessOfVisibility(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "ownposts")

	createPost(t, f, author, "T1", "C1", posts.VisibilityPublic, nil)
	createPost(t, f, author, "T2", "C2", posts.VisibilityCustom, nil)

	list, err := f.postsSvc.ListPosts(author, 10)
	if err != nil {
		t.Fatalf("ListPosts: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("ListPosts for own user returned %d posts, want 2", len(list))
	}
}
