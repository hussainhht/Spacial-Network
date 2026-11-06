// Package saved_test covers the saved-posts (bookmarks) feature in
// social/internal/posts: saving and unsaving, idempotency, newest-saved-first
// ordering and cursor pagination, privacy between accounts, and that
// visibility is rechecked every time the collection is read. It goes through
// the HTTP handlers because the post type is unexported.
package saved_test

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
	postsHandler *posts.Handler
	followersSvc *followers.Service
	groupsSvc    *groups.Service
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersSvc := followers.NewService(followers.NewRepository(db), nil, nil)
	usersSvc := users.NewService(users.NewRepository(db), followersSvc)
	groupsSvc := groups.NewService(groups.NewRepository(db), nil, websocket.NewHub())
	postsSvc := posts.NewService(posts.NewRepository(db), followersSvc, groupsSvc)

	postMedia, err := upload.NewMediaStorage(t.TempDir(), upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage(posts): %v", err)
	}
	handler := posts.NewHandler(postsSvc, usersSvc, groupsSvc, postMedia, "session_token", false, 0)

	return fixture{db: db, postsHandler: handler, followersSvc: followersSvc, groupsSvc: groupsSvc}
}

func (f fixture) newUser(t *testing.T, username string) int {
	t.Helper()
	return testutil.CreateUser(t, f.db, testutil.NewUserOpts{Username: username, Email: username + "@example.com"})
}

func withUser(req *http.Request, userID int) *http.Request {
	return req.WithContext(requestctx.WithUserID(req.Context(), userID))
}

func (f fixture) newPost(t *testing.T, authorID int, visibility string) int {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("title", "A post")
	w.WriteField("content", "Some content")
	w.WriteField("visibility", visibility)
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/posts", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()
	f.postsHandler.NewPostHandler(rr, withUser(req, authorID))
	if rr.Code != http.StatusCreated {
		t.Fatalf("create post: status=%d body=%s", rr.Code, rr.Body.String())
	}
	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal post: %v", err)
	}
	return resp.ID
}

func (f fixture) newGroupWithPost(t *testing.T, creatorID int) (groupID, postID int) {
	t.Helper()
	gid, err := f.groupsSvc.CreateGroup(creatorID, "A group", "desc", "", groups.GroupPrivacyPublic)
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
	req.SetPathValue("id", strconv.FormatInt(gid, 10))
	rr := httptest.NewRecorder()
	f.postsHandler.NewGroupPostHandler(rr, withUser(req, creatorID))
	if rr.Code != http.StatusCreated {
		t.Fatalf("create group post: status=%d body=%s", rr.Code, rr.Body.String())
	}
	var resp posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal group post: %v", err)
	}
	return int(gid), resp.ID
}

func (f fixture) setVisibility(t *testing.T, ownerID, postID int, visibility string) {
	t.Helper()
	body, _ := json.Marshal(posts.EditPostRequest{Title: "A post", Content: "Some content", Visibility: visibility})
	req := httptest.NewRequest(http.MethodPut, "/api/posts", bytes.NewReader(body))
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	f.postsHandler.EditPostHandler(rr, withUser(req, ownerID))
	if rr.Code != http.StatusOK {
		t.Fatalf("edit post: status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func (f fixture) deletePost(t *testing.T, ownerID, postID int) {
	t.Helper()
	req := httptest.NewRequest(http.MethodDelete, "/api/posts", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	f.postsHandler.DeletePostHandler(rr, withUser(req, ownerID))
	if rr.Code != http.StatusOK {
		t.Fatalf("delete post: status=%d body=%s", rr.Code, rr.Body.String())
	}
}

// do invokes the save (POST) or unsave (DELETE) handler for userID.
func (f fixture) do(method string, userID, postID int) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/api/posts/save", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	if method == http.MethodPost {
		f.postsHandler.SavePostHandler(rr, withUser(req, userID))
	} else {
		f.postsHandler.UnsavePostHandler(rr, withUser(req, userID))
	}
	return rr
}

func (f fixture) save(t *testing.T, userID, postID int) {
	t.Helper()
	if rr := f.do(http.MethodPost, userID, postID); rr.Code != http.StatusOK {
		t.Fatalf("save post %d: status=%d body=%s", postID, rr.Code, rr.Body.String())
	}
}

func (f fixture) unsave(t *testing.T, userID, postID int) {
	t.Helper()
	if rr := f.do(http.MethodDelete, userID, postID); rr.Code != http.StatusOK {
		t.Fatalf("unsave post %d: status=%d body=%s", postID, rr.Code, rr.Body.String())
	}
}

// list calls the saved-posts handler; query is e.g. "limit=2&cursor=7".
func (f fixture) list(t *testing.T, userID int, query string) (int, posts.SavedPostsResponse) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/users/me/saved-posts?"+query, nil)
	rr := httptest.NewRecorder()
	f.postsHandler.ListSavedPostsHandler(rr, withUser(req, userID))
	var resp posts.SavedPostsResponse
	if rr.Code == http.StatusOK {
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal saved posts: %v (body=%s)", err, rr.Body.String())
		}
	}
	return rr.Code, resp
}

func (f fixture) listIDs(t *testing.T, userID int) []int {
	t.Helper()
	status, resp := f.list(t, userID, "")
	if status != http.StatusOK {
		t.Fatalf("list saved: status=%d", status)
	}
	ids := make([]int, 0, len(resp.Posts))
	for _, p := range resp.Posts {
		ids = append(ids, p.ID)
	}
	return ids
}

func assertIDs(t *testing.T, got []int, want ...int) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("ids = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ids = %v, want %v", got, want)
		}
	}
}

func TestSavePost_PublicPostAppearsInCollectionMarkedSaved(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	postID := f.newPost(t, author, posts.VisibilityPublic)

	rr := f.do(http.MethodPost, reader, postID)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	var status posts.SavedStatusResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if status.PostID != postID || !status.Saved {
		t.Errorf("status = %+v, want post %d saved", status, postID)
	}

	_, resp := f.list(t, reader, "")
	if len(resp.Posts) != 1 || resp.Posts[0].ID != postID {
		t.Fatalf("saved posts = %+v, want only post %d", resp.Posts, postID)
	}
	if !resp.Posts[0].Saved {
		t.Error("saved post in the collection has Saved = false")
	}
	if resp.Posts[0].Author.Username != "author" {
		t.Errorf("author = %q, want author", resp.Posts[0].Author.Username)
	}
}

func TestSavePost_RepeatedSaveIsIdempotentAndKeepsOrder(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	first := f.newPost(t, author, posts.VisibilityPublic)
	second := f.newPost(t, author, posts.VisibilityPublic)

	f.save(t, reader, first)
	f.save(t, reader, second)
	f.save(t, reader, first) // already saved: must not duplicate or move

	assertIDs(t, f.listIDs(t, reader), second, first)

	var count int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM user_saved_posts WHERE user_id = ?`, reader).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("stored bookmarks = %d, want 2", count)
	}
}

func TestUnsavePost_RemovesAndIsIdempotent(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	postID := f.newPost(t, author, posts.VisibilityPublic)

	f.save(t, reader, postID)
	f.unsave(t, reader, postID)
	f.unsave(t, reader, postID) // already removed: still 200
	assertIDs(t, f.listIDs(t, reader))

	// Removing a bookmark for a post that never existed is also harmless.
	f.unsave(t, reader, 999999)
}

func TestListSavedPosts_NewestSavedFirstNotNewestPosted(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	a := f.newPost(t, author, posts.VisibilityPublic)
	b := f.newPost(t, author, posts.VisibilityPublic)
	c := f.newPost(t, author, posts.VisibilityPublic)

	// Saved in a different order than posted; re-saving after an unsave
	// moves a post back to the top.
	f.save(t, reader, b)
	f.save(t, reader, c)
	f.save(t, reader, a)
	assertIDs(t, f.listIDs(t, reader), a, c, b)

	f.unsave(t, reader, c)
	f.save(t, reader, c)
	assertIDs(t, f.listIDs(t, reader), c, a, b)
}

func TestListSavedPosts_PaginationHasNoDuplicatesOrGaps(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")

	const total = 7
	var saved []int
	for i := 0; i < total; i++ {
		id := f.newPost(t, author, posts.VisibilityPublic)
		f.save(t, reader, id)
		saved = append(saved, id)
	}

	var seen []int
	query := "limit=3"
	pages := 0
	for {
		status, resp := f.list(t, reader, query)
		if status != http.StatusOK {
			t.Fatalf("page %d: status=%d", pages, status)
		}
		pages++
		for _, p := range resp.Posts {
			seen = append(seen, p.ID)
		}
		if resp.NextCursor == nil {
			break
		}
		if len(resp.Posts) != 3 {
			t.Fatalf("page with next_cursor has %d posts, want 3", len(resp.Posts))
		}
		if pages > total {
			t.Fatal("pagination did not terminate")
		}
		// A save between pages must not shift or repeat what is left.
		if pages == 1 {
			f.save(t, reader, f.newPost(t, author, posts.VisibilityPublic))
		}
		query = "limit=3&cursor=" + strconv.Itoa(*resp.NextCursor)
	}

	if pages != 3 {
		t.Errorf("pages = %d, want 3 (3+3+1)", pages)
	}
	want := make([]int, 0, total)
	for i := total - 1; i >= 0; i-- {
		want = append(want, saved[i])
	}
	assertIDs(t, seen, want...)
}

func TestListSavedPosts_ExactMultipleOfLimitHasNoTrailingCursor(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	for i := 0; i < 4; i++ {
		f.save(t, reader, f.newPost(t, author, posts.VisibilityPublic))
	}

	_, first := f.list(t, reader, "limit=2")
	if first.NextCursor == nil {
		t.Fatal("first page has no next_cursor")
	}
	_, second := f.list(t, reader, "limit=2&cursor="+strconv.Itoa(*first.NextCursor))
	if len(second.Posts) != 2 || second.NextCursor != nil {
		t.Errorf("second page = %d posts, next_cursor=%v; want 2 posts and no cursor", len(second.Posts), second.NextCursor)
	}
}

func TestSavedPosts_RejectUnauthenticated(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	postID := f.newPost(t, author, posts.VisibilityPublic)

	req := httptest.NewRequest(http.MethodPost, "/api/posts/save", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	f.postsHandler.SavePostHandler(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("save: status = %d, want 401", rr.Code)
	}

	rr = httptest.NewRecorder()
	f.postsHandler.UnsavePostHandler(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("unsave: status = %d, want 401", rr.Code)
	}

	rr = httptest.NewRecorder()
	f.postsHandler.ListSavedPostsHandler(rr, httptest.NewRequest(http.MethodGet, "/api/users/me/saved-posts", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("list: status = %d, want 401", rr.Code)
	}
}

func TestSavedPosts_ValidateInput(t *testing.T) {
	f := setup(t)
	reader := f.newUser(t, "reader")

	for _, id := range []string{"abc", "0", "-3", ""} {
		req := httptest.NewRequest(http.MethodPost, "/api/posts/save", nil)
		req.SetPathValue("id", id)
		rr := httptest.NewRecorder()
		f.postsHandler.SavePostHandler(rr, withUser(req, reader))
		if rr.Code != http.StatusBadRequest {
			t.Errorf("save id %q: status = %d, want 400", id, rr.Code)
		}
	}

	for _, query := range []string{"limit=0", "limit=x", "cursor=0", "cursor=abc", "cursor=-1"} {
		if status, _ := f.list(t, reader, query); status != http.StatusBadRequest {
			t.Errorf("list %q: status = %d, want 400", query, status)
		}
	}

	if rr := f.do(http.MethodPost, reader, 999999); rr.Code != http.StatusNotFound {
		t.Errorf("save missing post: status = %d, want 404", rr.Code)
	}
}

func TestSavedPosts_AreCompletelyPrivateBetweenAccounts(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	alice := f.newUser(t, "alice")
	bob := f.newUser(t, "bob")
	postID := f.newPost(t, author, posts.VisibilityPublic)

	f.save(t, alice, postID)

	// The collection is derived from the session: Bob never sees Alice's, and
	// a client-supplied user id is ignored.
	assertIDs(t, f.listIDs(t, bob))
	_, resp := f.list(t, bob, "user_id="+strconv.Itoa(alice))
	if len(resp.Posts) != 0 {
		t.Errorf("client-supplied user_id leaked %d posts", len(resp.Posts))
	}

	// Alice's bookmark is not Bob's, so it is not reported as saved for him,
	// and his unsave cannot remove hers.
	f.unsave(t, bob, postID)
	assertIDs(t, f.listIDs(t, alice), postID)

	req := httptest.NewRequest(http.MethodGet, "/api/posts/1", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	rr := httptest.NewRecorder()
	f.postsHandler.GetPostByIDHandler(rr, withUser(req, bob))
	var asBob posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &asBob); err != nil {
		t.Fatal(err)
	}
	if asBob.Saved {
		t.Error("post reads as saved for an account that did not save it")
	}
	rr = httptest.NewRecorder()
	f.postsHandler.GetPostByIDHandler(rr, withUser(req, alice))
	var asAlice posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &asAlice); err != nil {
		t.Fatal(err)
	}
	if !asAlice.Saved {
		t.Error("post does not read as saved for the account that saved it")
	}
}

func TestSavePost_RejectsInaccessiblePostsWithoutLeaking(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	stranger := f.newUser(t, "stranger")
	followersOnly := f.newPost(t, author, posts.VisibilityFollowers)
	custom := f.newPost(t, author, posts.VisibilityCustom)
	_, groupPost := f.newGroupWithPost(t, author)

	for name, id := range map[string]int{"followers-only": followersOnly, "custom": custom, "group": groupPost} {
		inaccessible := f.do(http.MethodPost, stranger, id)
		missing := f.do(http.MethodPost, stranger, 999999)
		if inaccessible.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404", name, inaccessible.Code)
		}
		// Indistinguishable from a post that does not exist.
		if inaccessible.Body.String() != missing.Body.String() {
			t.Errorf("%s: body %q differs from missing-post body %q", name, inaccessible.Body.String(), missing.Body.String())
		}
	}
	assertIDs(t, f.listIDs(t, stranger))
}

func TestSavePost_FollowerCanSaveFollowersOnlyPost(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	follower := f.newUser(t, "follower")
	postID := f.newPost(t, author, posts.VisibilityFollowers)
	if err := f.followersSvc.FollowUser(follower, author); err != nil {
		t.Fatalf("follow: %v", err)
	}

	f.save(t, follower, postID)
	assertIDs(t, f.listIDs(t, follower), postID)

	// The author can bookmark their own post too.
	f.save(t, author, postID)
}

func TestListSavedPosts_VisibilityIsRecheckedOnRead(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	postID := f.newPost(t, author, posts.VisibilityPublic)
	stable := f.newPost(t, author, posts.VisibilityPublic)
	f.save(t, reader, postID)
	f.save(t, reader, stable)

	f.setVisibility(t, author, postID, posts.VisibilityFollowers)

	// No trace of the now-restricted post: not its id, title, media or author.
	_, resp := f.list(t, reader, "")
	assertIDs(t, idsOf(resp), stable)

	req := httptest.NewRequest(http.MethodGet, "/api/users/me/saved-posts", nil)
	rr := httptest.NewRecorder()
	f.postsHandler.ListSavedPostsHandler(rr, withUser(req, reader))
	if bytes.Contains(rr.Body.Bytes(), []byte(`{"id":`+strconv.Itoa(postID)+`,"user_id"`)) {
		t.Errorf("restricted post leaked into the response: %s", rr.Body.String())
	}

	// Access is restored when the audience is: the bookmark was kept, not
	// treated as a permanent grant or silently dropped.
	f.setVisibility(t, author, postID, posts.VisibilityPublic)
	assertIDs(t, f.listIDs(t, reader), stable, postID)
}

func TestListSavedPosts_LosingFollowerAccessHidesPost(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	follower := f.newUser(t, "follower")
	postID := f.newPost(t, author, posts.VisibilityFollowers)
	if err := f.followersSvc.FollowUser(follower, author); err != nil {
		t.Fatalf("follow: %v", err)
	}
	f.save(t, follower, postID)

	if err := f.followersSvc.UnfollowUser(follower, author); err != nil {
		t.Fatalf("unfollow: %v", err)
	}
	assertIDs(t, f.listIDs(t, follower))

	// The user can still clear the bookmark they can no longer see.
	f.unsave(t, follower, postID)
}

func TestListSavedPosts_DeletedPostsDisappear(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	doomed := f.newPost(t, author, posts.VisibilityPublic)
	kept := f.newPost(t, author, posts.VisibilityPublic)
	f.save(t, reader, doomed)
	f.save(t, reader, kept)

	f.deletePost(t, author, doomed)

	assertIDs(t, f.listIDs(t, reader), kept)
	var rows int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM user_saved_posts WHERE post_id = ?`, doomed).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Errorf("bookmark rows for the deleted post = %d, want 0 (cascade)", rows)
	}
	if rr := f.do(http.MethodPost, reader, doomed); rr.Code != http.StatusNotFound {
		t.Errorf("saving a deleted post: status = %d, want 404", rr.Code)
	}
}

func TestListSavedPosts_GroupPostsRequireCurrentMembership(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "creator")
	member := f.newUser(t, "member")
	groupID, postID := f.newGroupWithPost(t, creator)

	// A non-member cannot save a group post.
	if rr := f.do(http.MethodPost, member, postID); rr.Code != http.StatusNotFound {
		t.Fatalf("non-member save: status = %d, want 404", rr.Code)
	}

	if err := f.groupsSvc.AddMember(groupID, member); err != nil {
		t.Fatalf("add member: %v", err)
	}
	f.save(t, member, postID)
	_, resp := f.list(t, member, "")
	if len(resp.Posts) != 1 || resp.Posts[0].GroupID == nil || *resp.Posts[0].GroupID != groupID {
		t.Fatalf("saved group post missing or lacks its group: %+v", resp.Posts)
	}
	if resp.Posts[0].GroupTitle != "A group" {
		t.Errorf("group title = %q, want %q", resp.Posts[0].GroupTitle, "A group")
	}

	// Removed from the group: the content is no longer reachable via the bookmark.
	if err := f.groupsSvc.RemoveMember(groupID, creator, member); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	assertIDs(t, f.listIDs(t, member))

	// Rejoining restores it.
	if err := f.groupsSvc.AddMember(groupID, member); err != nil {
		t.Fatalf("re-add member: %v", err)
	}
	assertIDs(t, f.listIDs(t, member), postID)
}

func TestListSavedPosts_InaccessibleRunsDoNotShortenOrBreakPages(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")

	visible := f.newPost(t, author, posts.VisibilityPublic)
	var hidden []int
	for i := 0; i < 5; i++ {
		hidden = append(hidden, f.newPost(t, author, posts.VisibilityPublic))
	}
	newest := f.newPost(t, author, posts.VisibilityPublic)

	f.save(t, reader, visible)
	for _, id := range hidden {
		f.save(t, reader, id)
	}
	f.save(t, reader, newest)
	for _, id := range hidden {
		f.setVisibility(t, author, id, posts.VisibilityFollowers)
	}

	status, page1 := f.list(t, reader, "limit=1")
	if status != http.StatusOK || len(page1.Posts) != 1 || page1.Posts[0].ID != newest {
		t.Fatalf("page 1 = %+v", page1.Posts)
	}
	if page1.NextCursor == nil {
		t.Fatal("page 1 has no next_cursor although another accessible post follows the hidden ones")
	}
	_, page2 := f.list(t, reader, "limit=1&cursor="+strconv.Itoa(*page1.NextCursor))
	if len(page2.Posts) != 1 || page2.Posts[0].ID != visible || page2.NextCursor != nil {
		t.Fatalf("page 2 = %+v next=%v, want only post %d and no cursor", page2.Posts, page2.NextCursor, visible)
	}
}

func TestSavedState_AppearsInFeedGroupAndDetailResponses(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "author")
	reader := f.newUser(t, "reader")
	savedPost := f.newPost(t, author, posts.VisibilityPublic)
	otherPost := f.newPost(t, author, posts.VisibilityPublic)
	f.save(t, reader, savedPost)

	req := httptest.NewRequest(http.MethodGet, "/api/posts", nil)
	rr := httptest.NewRecorder()
	f.postsHandler.ListPostsHandler(rr, withUser(req, reader))
	var feed []posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	flags := map[int]bool{}
	for _, p := range feed {
		flags[p.ID] = p.Saved
	}
	if !flags[savedPost] || flags[otherPost] {
		t.Errorf("feed saved flags = %v, want %d saved and %d not", flags, savedPost, otherPost)
	}

	groupID, groupPost := f.newGroupWithPost(t, reader)
	f.save(t, reader, groupPost)
	req = httptest.NewRequest(http.MethodGet, "/api/groups/posts", nil)
	req.SetPathValue("id", strconv.Itoa(groupID))
	rr = httptest.NewRecorder()
	f.postsHandler.ListGroupPostsHandler(rr, withUser(req, reader))
	var groupFeed []posts.PostResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &groupFeed); err != nil {
		t.Fatal(err)
	}
	if len(groupFeed) != 1 || !groupFeed[0].Saved {
		t.Errorf("group feed = %+v, want one saved post", groupFeed)
	}
}

func idsOf(resp posts.SavedPostsResponse) []int {
	ids := make([]int, 0, len(resp.Posts))
	for _, p := range resp.Posts {
		ids = append(ids, p.ID)
	}
	return ids
}
