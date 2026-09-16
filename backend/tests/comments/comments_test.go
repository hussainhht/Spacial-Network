// Package comments_test covers social/internal/comments: attaching a
// comment to an existing post, rejecting comments on posts that don't
// exist, and image/GIF attachments (accepted content types persisted
// correctly, disallowed types rejected) via the HTTP handler layer, since
// the comment type is unexported.
package comments_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"social/internal/comments"
	"social/internal/followers"
	"social/internal/groups"
	"social/internal/notifications"
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db              *sql.DB
	postsHandler    *posts.Handler
	commentsHandler *comments.Handler
	commentsSvc     *comments.Service
	notifSvc        *notifications.Service
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

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo, nil)

	commentsRepo := comments.NewRepository(db)
	commentsSvc := comments.NewService(commentsRepo, postsSvc, notifSvc)

	commentMedia, err := upload.NewMediaStorage(t.TempDir(), upload.CommentsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage(comments): %v", err)
	}
	commentsHandler := comments.NewHandler(commentsSvc, commentMedia)

	return fixture{db: db, postsHandler: postsHandler, commentsHandler: commentsHandler, commentsSvc: commentsSvc, notifSvc: notifSvc}
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

// newCommentRequest builds a multipart NewCommentHandler request, optionally
// attaching imageBytes as a file named "image".
func newCommentRequest(t *testing.T, userID, postID int, content string, imageBytes []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if err := w.WriteField("content", content); err != nil {
		t.Fatalf("write field: %v", err)
	}
	if imageBytes != nil {
		part, err := w.CreateFormFile("image", "attachment")
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		if _, err := part.Write(imageBytes); err != nil {
			t.Fatalf("write image bytes: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/posts/comments", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.SetPathValue("id", strconv.Itoa(postID))
	req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	return req
}

func TestCreateComment_AttachesToExistingPost(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "postauthor")
	commenter := f.newUser(t, "commenter")
	postID := f.newPublicPost(t, author)

	req := newCommentRequest(t, commenter, postID, "Nice post!", nil)
	rr := httptest.NewRecorder()
	f.commentsHandler.NewCommentHandler(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var resp comments.CommentResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.PostID != postID {
		t.Errorf("PostID = %d, want %d", resp.PostID, postID)
	}
	if resp.Content != "Nice post!" {
		t.Errorf("Content = %q, want %q", resp.Content, "Nice post!")
	}
	if resp.Author.ID != commenter || resp.Author.Username != "commenter" {
		t.Errorf("Author = %#v, want commenter identity", resp.Author)
	}
}

func TestListComments_IncludesEachAuthorProfile(t *testing.T) {
	f := setup(t)
	postAuthor := f.newUser(t, "profilepostauthor")
	first := f.newUser(t, "firstcommenter")
	second := f.newUser(t, "secondcommenter")
	if _, err := f.db.Exec(`UPDATE users SET profile_photo = ? WHERE id = ?`, "avatars/first.jpg", first); err != nil {
		t.Fatalf("set profile photo: %v", err)
	}
	postID := f.newPublicPost(t, postAuthor)

	for _, userID := range []int{first, second} {
		req := newCommentRequest(t, userID, postID, "Hello", nil)
		rr := httptest.NewRecorder()
		f.commentsHandler.NewCommentHandler(rr, req)
		if rr.Code != http.StatusCreated {
			t.Fatalf("create comment: status=%d body=%s", rr.Code, rr.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/posts/comments", nil)
	req.SetPathValue("id", strconv.Itoa(postID))
	req = req.WithContext(requestctx.WithUserID(req.Context(), postAuthor))
	rr := httptest.NewRecorder()
	f.commentsHandler.ListCommentsHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list comments: status=%d body=%s", rr.Code, rr.Body.String())
	}

	var response []comments.CommentResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal comments: %v", err)
	}
	if len(response) != 2 {
		t.Fatalf("comments length = %d, want 2", len(response))
	}
	if response[0].Author.Username != "firstcommenter" || response[0].Author.ProfilePhoto != "/uploads/avatars/first.jpg" {
		t.Errorf("first author = %#v", response[0].Author)
	}
	if response[1].Author.Username != "secondcommenter" || response[1].Author.ProfilePhoto != "" {
		t.Errorf("second author = %#v", response[1].Author)
	}
}

func TestCreateComment_NonExistentPost_Fails(t *testing.T) {
	f := setup(t)
	commenter := f.newUser(t, "commenter2")

	req := newCommentRequest(t, commenter, 999999, "Hello?", nil)
	rr := httptest.NewRecorder()
	f.commentsHandler.NewCommentHandler(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNotFound, rr.Body.String())
	}
}

func TestCreateComment_ImageAttachment_AcceptedTypes(t *testing.T) {
	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0x01, 0x00, 0x00, 0x01}
	png := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}
	gif := []byte("GIF89a" + "\x00\x00\x00\x00\x00\x00")

	tests := []struct {
		name  string
		bytes []byte
	}{
		{"jpeg", jpeg},
		{"png", png},
		{"gif", gif},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := setup(t)
			author := f.newUser(t, tt.name+"author")
			postID := f.newPublicPost(t, author)

			req := newCommentRequest(t, author, postID, "with image", tt.bytes)
			rr := httptest.NewRecorder()
			f.commentsHandler.NewCommentHandler(rr, req)

			if rr.Code != http.StatusCreated {
				t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
			}

			var resp comments.CommentResponse
			if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if resp.ImageURL == "" {
				t.Errorf("expected a persisted image URL for a %s attachment", tt.name)
			}
		})
	}
}

func TestCreateComment_ImageAttachment_RejectsDisallowedType(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "badimgauthor")
	postID := f.newPublicPost(t, author)

	textBytes := []byte("this is just plain text, not an image at all, definitely not")
	req := newCommentRequest(t, author, postID, "with bad image", textBytes)
	rr := httptest.NewRecorder()
	f.commentsHandler.NewCommentHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusBadRequest, rr.Body.String())
	}
}

func TestCreateComment_NotifiesAuthor(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "notifycommentauthor")
	commenter := f.newUser(t, "notifycommenter")
	postID := f.newPublicPost(t, author)

	req := newCommentRequest(t, commenter, postID, "Nice post!", nil)
	rr := httptest.NewRecorder()
	f.commentsHandler.NewCommentHandler(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	notifs, err := f.notifSvc.GetForUser(author, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(author): %v", err)
	}
	if len(notifs) != 1 {
		t.Fatalf("expected 1 notification for the author, got %d", len(notifs))
	}
	if notifs[0].Type != notifications.NotificationPostComment {
		t.Errorf("notification type = %q, want %q", notifs[0].Type, notifications.NotificationPostComment)
	}
}

func TestCreateComment_SelfComment_NoNotification(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "selfcommentauthor")
	postID := f.newPublicPost(t, author)

	req := newCommentRequest(t, author, postID, "Commenting on my own post", nil)
	rr := httptest.NewRecorder()
	f.commentsHandler.NewCommentHandler(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	notifs, err := f.notifSvc.GetForUser(author, 10, 0)
	if err != nil {
		t.Fatalf("GetForUser(author): %v", err)
	}
	if len(notifs) != 0 {
		t.Fatalf("expected no self-notification for commenting on your own post, got %d", len(notifs))
	}
}
