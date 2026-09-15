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
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

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
	followersSvc := followers.NewService(followersRepo, nil, nil)

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

type mediaFixture struct {
	name string
	data []byte
}

func newMultiMediaPostRequest(t *testing.T, userID int, attachments []mediaFixture) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if err := w.WriteField("title", "Media post"); err != nil {
		t.Fatal(err)
	}
	if err := w.WriteField("content", "Ordered attachments"); err != nil {
		t.Fatal(err)
	}
	if err := w.WriteField("visibility", posts.VisibilityPublic); err != nil {
		t.Fatal(err)
	}
	for _, attachment := range attachments {
		part, err := w.CreateFormFile("media", attachment.name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(attachment.data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req.WithContext(requestctx.WithUserID(req.Context(), userID))
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

func TestCreatePost_MultipleMediaPersistsAndReturnsInOrder(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "mediaauthor")
	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01}
	png := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00}
	gif := []byte("GIF89a\x00\x00\x00\x00\x00\x00")

	req := newMultiMediaPostRequest(t, author, []mediaFixture{
		{name: "first.jpg", data: jpeg},
		{name: "second.gif", data: gif},
		{name: "third.png", data: png},
	})
	rr := httptest.NewRecorder()
	f.postsHandler.NewPostHandler(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d; body=%s", rr.Code, rr.Body.String())
	}

	var created posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if len(created.Media) != 3 {
		t.Fatalf("created media count = %d, want 3", len(created.Media))
	}
	for i, item := range created.Media {
		if item.Order != i {
			t.Errorf("media[%d].order = %d", i, item.Order)
		}
	}
	if created.Media[1].Type != "gif" {
		t.Errorf("second media type = %q, want gif", created.Media[1].Type)
	}
	if created.ImageURL != created.Media[0].URL {
		t.Errorf("legacy image_url must mirror first media item")
	}

	var count int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM post_media WHERE post_id = ?`, created.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Errorf("persisted media count = %d, want 3", count)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/posts/1", nil)
	getReq.SetPathValue("id", strconv.Itoa(created.ID))
	getReq = getReq.WithContext(requestctx.WithUserID(getReq.Context(), author))
	getRR := httptest.NewRecorder()
	f.postsHandler.GetPostByIDHandler(getRR, getReq)
	var fetched posts.PostResponse
	if err := json.Unmarshal(getRR.Body.Bytes(), &fetched); err != nil {
		t.Fatal(err)
	}
	if len(fetched.Media) != 3 || fetched.Media[1].Type != "gif" {
		t.Errorf("GET media = %#v", fetched.Media)
	}

	_, feed := listFeed(t, f, author, "")
	if len(feed) != 1 || len(feed[0].Media) != 3 {
		t.Errorf("feed did not return all media: %#v", feed)
	}
}

func TestCreatePost_InvalidMediaRejectsWholePost(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "invalidmedia")
	req := newMultiMediaPostRequest(t, author, []mediaFixture{{name: "fake.png", data: []byte("not an image")}})
	rr := httptest.NewRecorder()
	f.postsHandler.NewPostHandler(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rr.Code, rr.Body.String())
	}
	var count int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM posts WHERE user_id = ?`, author).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("invalid upload created %d posts", count)
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

	list, err := f.postsSvc.ListPosts(author, 10, posts.FeedAll)
	if err != nil {
		t.Fatalf("ListPosts: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("ListPosts for own user returned %d posts, want 2", len(list))
	}
}

func TestListPosts_CursorPaginationHasNoOverlap(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "cursorviewer")
	for i := 0; i < 5; i++ {
		createPost(t, f, viewer, fmt.Sprintf("Cursor %d", i), "page me", posts.VisibilityPublic, nil)
	}

	requestPage := func(query string) []posts.PostResponse {
		req := httptest.NewRequest(http.MethodGet, "/api/posts?"+query, nil)
		req = req.WithContext(requestctx.WithUserID(req.Context(), viewer))
		rr := httptest.NewRecorder()
		f.postsHandler.ListPostsHandler(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("page status = %d; body=%s", rr.Code, rr.Body.String())
		}
		var page []posts.PostResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &page); err != nil {
			t.Fatalf("unmarshal page: %v", err)
		}
		return page
	}

	first := requestPage("limit=2")
	if len(first) != 2 {
		t.Fatalf("first page length = %d, want 2", len(first))
	}
	cursor := first[len(first)-1]
	second := requestPage("limit=2&before=" + url.QueryEscape(cursor.CreatedAt.Format(time.RFC3339Nano)) + "&before_id=" + strconv.Itoa(cursor.ID))
	if len(second) != 2 {
		t.Fatalf("second page length = %d, want 2", len(second))
	}
	seen := postIDs(first)
	for _, post := range second {
		if seen[post.ID] {
			t.Fatalf("post %d appeared in both cursor pages", post.ID)
		}
	}
}

func TestListPosts_RejectsIncompleteCursor(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "badcursorviewer")
	req := httptest.NewRequest(http.MethodGet, "/api/posts?limit=20&before_id=12", nil)
	req = req.WithContext(requestctx.WithUserID(req.Context(), viewer))
	rr := httptest.NewRecorder()
	f.postsHandler.ListPostsHandler(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rr.Code, rr.Body.String())
	}
}

func postIDs(list []posts.PostResponse) map[int]bool {
	ids := make(map[int]bool, len(list))
	for _, p := range list {
		ids[p.ID] = true
	}
	return ids
}

// listFeed drives ListPostsHandler directly (rather than the unexported
// Service.ListPosts) so these tests exercise feed-scope validation and
// response shaping exactly as the real API does.
func listFeed(t *testing.T, f fixture, viewerID int, feed string) (*httptest.ResponseRecorder, []posts.PostResponse) {
	t.Helper()

	query := ""
	if feed != "" {
		query = "?feed=" + feed
	}
	req := httptest.NewRequest(http.MethodGet, "/api/posts"+query, nil)
	req = req.WithContext(requestctx.WithUserID(req.Context(), viewerID))

	rr := httptest.NewRecorder()
	f.postsHandler.ListPostsHandler(rr, req)

	var list []posts.PostResponse
	if rr.Code == http.StatusOK {
		if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
			t.Fatalf("unmarshal feed response: %v", err)
		}
	}
	return rr, list
}

func TestListPosts_FeedFollowing_IncludesFollowedExcludesOthers(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "followingviewer")
	followed := f.newUser(t, "followingfollowed")
	stranger := f.newUser(t, "followingstranger")

	if err := f.followersSvc.FollowUser(viewer, followed); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	followedPost := createPost(t, f, followed, "T1", "from followed", posts.VisibilityPublic, nil)
	createPost(t, f, stranger, "T2", "from stranger", posts.VisibilityPublic, nil)
	createPost(t, f, viewer, "T3", "own post", posts.VisibilityPublic, nil)

	rr, list := listFeed(t, f, viewer, "following")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	ids := postIDs(list)
	if !ids[followedPost.ID] {
		t.Errorf("following feed must include a post from a followed author")
	}
	if len(list) != 1 {
		t.Errorf("following feed = %d posts, want exactly 1 (got %v)", len(list), ids)
	}
}

func TestListPosts_FeedFollowing_StillRespectsPrivacy(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "followingprivviewer")
	followed := f.newUser(t, "followingprivfollowed")

	// viewer follows followed, but followed does not follow back, so a
	// followers-only post from followed must stay hidden from viewer even
	// though followed is in the "following" author scope.
	if err := f.followersSvc.FollowUser(viewer, followed); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	// followed's custom post only grants access to their own followers -
	// viewer isn't one, so it must not leak into the following feed either.
	otherFollowerOfFollowed := f.newUser(t, "followingprivother")
	if err := f.followersSvc.FollowUser(otherFollowerOfFollowed, followed); err != nil {
		t.Fatalf("FollowUser other: %v", err)
	}
	customPost := createPost(t, f, followed, "T", "custom", posts.VisibilityCustom, []int{otherFollowerOfFollowed})

	rr, list := listFeed(t, f, viewer, "following")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if postIDs(list)[customPost.ID] {
		t.Errorf("following feed must not leak a custom post the viewer isn't an allowed viewer of")
	}
}

func TestListPosts_FeedFriends_RequiresMutualFollow(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "friendsviewer")
	mutual := f.newUser(t, "friendsmutual")
	oneWayOut := f.newUser(t, "friendsonewayout") // viewer follows them, they don't follow back
	oneWayIn := f.newUser(t, "friendsonewayin")   // they follow viewer, viewer doesn't follow back

	if err := f.followersSvc.FollowUser(viewer, mutual); err != nil {
		t.Fatalf("FollowUser viewer->mutual: %v", err)
	}
	if err := f.followersSvc.FollowUser(mutual, viewer); err != nil {
		t.Fatalf("FollowUser mutual->viewer: %v", err)
	}
	if err := f.followersSvc.FollowUser(viewer, oneWayOut); err != nil {
		t.Fatalf("FollowUser viewer->oneWayOut: %v", err)
	}
	if err := f.followersSvc.FollowUser(oneWayIn, viewer); err != nil {
		t.Fatalf("FollowUser oneWayIn->viewer: %v", err)
	}

	mutualPost := createPost(t, f, mutual, "T1", "mutual friend", posts.VisibilityPublic, nil)
	createPost(t, f, oneWayOut, "T2", "one-way out", posts.VisibilityPublic, nil)
	createPost(t, f, oneWayIn, "T3", "one-way in", posts.VisibilityPublic, nil)

	rr, list := listFeed(t, f, viewer, "friends")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	ids := postIDs(list)
	if !ids[mutualPost.ID] {
		t.Errorf("friends feed must include a post from a mutual follow")
	}
	if len(list) != 1 {
		t.Errorf("friends feed = %d posts, want exactly 1 (got %v)", len(list), ids)
	}
}

func TestListPosts_FeedFriends_StillRespectsPrivacy(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "friendsprivviewer")
	mutual := f.newUser(t, "friendsprivmutual")

	if err := f.followersSvc.FollowUser(viewer, mutual); err != nil {
		t.Fatalf("FollowUser viewer->mutual: %v", err)
	}
	if err := f.followersSvc.FollowUser(mutual, viewer); err != nil {
		t.Fatalf("FollowUser mutual->viewer: %v", err)
	}

	// A custom post from the mutual friend that doesn't include viewer on
	// its allowed-viewer list must still be hidden, even though viewer and
	// mutual are friends.
	otherFollower := f.newUser(t, "friendsprivother")
	if err := f.followersSvc.FollowUser(otherFollower, mutual); err != nil {
		t.Fatalf("FollowUser other->mutual: %v", err)
	}
	customPost := createPost(t, f, mutual, "T", "custom", posts.VisibilityCustom, []int{otherFollower})

	rr, list := listFeed(t, f, viewer, "friends")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	if postIDs(list)[customPost.ID] {
		t.Errorf("friends feed must not leak a custom post the viewer isn't an allowed viewer of")
	}
}

func TestListPosts_FeedAll_DefaultsWhenFeedParamOmitted(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "feedalldefault")
	createPost(t, f, author, "T", "C", posts.VisibilityPublic, nil)

	rr, list := listFeed(t, f, author, "")
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if len(list) != 1 {
		t.Errorf("default feed = %d posts, want 1", len(list))
	}
}

func TestListPosts_InvalidFeedValue_Returns400(t *testing.T) {
	f := setup(t)
	viewer := f.newUser(t, "feedinvalid")

	rr, _ := listFeed(t, f, viewer, "trending")
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}
