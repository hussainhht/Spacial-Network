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
}

func setup(t *testing.T) fixture {
	t.Helper()
	db := testutil.NewTestDB(t)

	followersRepo := followers.NewRepository(db)
	followersSvc := followers.NewService(followersRepo)

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

	commentsRepo := comments.NewRepository(db)
	commentsSvc := comments.NewService(commentsRepo, postsSvc)

	commentMedia, err := upload.NewMediaStorage(t.TempDir(), upload.CommentsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage(comments): %v", err)
	}
	commentsHandler := comments.NewHandler(commentsSvc, commentMedia)

	return fixture{db: db, postsHandler: postsHandler, commentsHandler: commentsHandler, commentsSvc: commentsSvc}
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
