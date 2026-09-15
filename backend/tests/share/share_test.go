// Package share_test covers social/internal/share: sharing a post as a
// direct message or a group message, the permission checks each route
// inherits by reuse (post must exist/be visible to the sharer; chat's own
// follow/group-membership rules gate the recipient), and request
// validation, via the HTTP handler layer since the share type is
// unexported.
package share_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"social/internal/chat"
	"social/internal/followers"
	"social/internal/groups"
	"social/internal/notifications"
	"social/internal/posts"
	"social/internal/requestctx"
	"social/internal/share"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
	"social/tests/testutil"
)

type fixture struct {
	db           *sql.DB
	postsHandler *posts.Handler
	postsSvc     *posts.Service
	groupsSvc    *groups.Service
	followersSvc *followers.Service
	chatRepo     *chat.Repository
	shareHandler *share.Handler
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

	chatRepo := chat.NewRepository(db)
	chatSvc := chat.NewService(chatRepo, websocket.NewHub(), notifSvc, followersSvc, groupsSvc)

	shareSvc := share.NewService(chatSvc, postsSvc)
	shareHandler := share.NewHandler(shareSvc)

	return fixture{
		db:           db,
		postsHandler: postsHandler,
		postsSvc:     postsSvc,
		groupsSvc:    groupsSvc,
		followersSvc: followersSvc,
		chatRepo:     chatRepo,
		shareHandler: shareHandler,
	}
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

// shareRequest builds a SharePostHandler request with the given JSON body.
func shareRequest(t *testing.T, userID, postID int, body share.ShareRequest) *http.Request {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal share request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/posts/share", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", strconv.Itoa(postID))
	if userID != 0 {
		req = req.WithContext(requestctx.WithUserID(req.Context(), userID))
	}
	return req
}

func TestSharePost_ToUser_DeliversAsPrivateMessageWithLink(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor")
	sender := f.newUser(t, "sharesender")
	recipient := f.newUser(t, "sharerecipient")
	postID := f.newPublicPost(t, author)

	// Chat only allows DMs between users with a follow relationship.
	if err := f.followersSvc.FollowUser(sender, recipient); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	req := shareRequest(t, sender, postID, share.ShareRequest{
		Target:   share.TargetUser,
		TargetID: int64(recipient),
		Message:  "check this out",
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusAccepted, rr.Body.String())
	}

	var resp share.ShareResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal share response: %v", err)
	}
	wantLink := "/posts/" + strconv.Itoa(postID)
	if resp.Link != wantLink {
		t.Errorf("Link = %q, want %q", resp.Link, wantLink)
	}

	history, err := f.chatRepo.GetPrivateHistory(int64(sender), int64(recipient), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 delivered message, got %d", len(history))
	}
	msg := history[0]
	if msg.Content != "check this out\n"+wantLink {
		t.Errorf("delivered content = %q", msg.Content)
	}
}

func TestSharePost_ToUser_WithoutNote_SendsLinkOnly(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor2")
	sender := f.newUser(t, "sharesender2")
	recipient := f.newUser(t, "sharerecipient2")
	postID := f.newPublicPost(t, author)

	if err := f.followersSvc.FollowUser(sender, recipient); err != nil {
		t.Fatalf("FollowUser: %v", err)
	}

	req := shareRequest(t, sender, postID, share.ShareRequest{
		Target:   share.TargetUser,
		TargetID: int64(recipient),
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusAccepted, rr.Body.String())
	}

	history, err := f.chatRepo.GetPrivateHistory(int64(sender), int64(recipient), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 delivered message, got %d", len(history))
	}
	wantLink := "/posts/" + strconv.Itoa(postID)
	if history[0].Content != wantLink {
		t.Errorf("delivered content = %q, want %q", history[0].Content, wantLink)
	}
}

func TestSharePost_ToUser_NotConnected_AcceptedButNotDelivered(t *testing.T) {
	// Chat's follow-relationship rule is enforced when the message is
	// handed over, not by this package, so a share to someone the sender
	// isn't connected to is accepted here but never actually lands - the
	// same asymmetry chat itself has for its WebSocket senders.
	f := setup(t)
	author := f.newUser(t, "shareauthor3")
	sender := f.newUser(t, "sharesender3")
	stranger := f.newUser(t, "strangerrecipient")
	postID := f.newPublicPost(t, author)

	req := shareRequest(t, sender, postID, share.ShareRequest{
		Target:   share.TargetUser,
		TargetID: int64(stranger),
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusAccepted, rr.Body.String())
	}

	history, err := f.chatRepo.GetPrivateHistory(int64(sender), int64(stranger), 10, 0)
	if err != nil {
		t.Fatalf("GetPrivateHistory: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("expected no message delivered to an unconnected user, got %d", len(history))
	}
}

func TestSharePost_ToGroup_DeliversAsGroupMessage(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor4")
	member := f.newUser(t, "sharegroupmember")
	postID := f.newPublicPost(t, author)

	groupID, err := f.groupsSvc.CreateGroup(member, "Share group", "desc", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}

	req := shareRequest(t, member, postID, share.ShareRequest{
		Target:   share.TargetGroup,
		TargetID: groupID,
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusAccepted, rr.Body.String())
	}

	history, err := f.chatRepo.GetGroupHistory(groupID, 10, 0)
	if err != nil {
		t.Fatalf("GetGroupHistory: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 delivered group message, got %d", len(history))
	}
	wantLink := "/posts/" + strconv.Itoa(postID)
	if history[0].Content != wantLink {
		t.Errorf("delivered content = %q, want %q", history[0].Content, wantLink)
	}
}

func TestSharePost_ToGroup_NotAMember_AcceptedButNotDelivered(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor5")
	creator := f.newUser(t, "sharegroupcreator")
	outsider := f.newUser(t, "sharegroupoutsider")
	postID := f.newPublicPost(t, author)

	groupID, err := f.groupsSvc.CreateGroup(creator, "Members only", "desc", "", groups.GroupPrivacyPublic)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}

	req := shareRequest(t, outsider, postID, share.ShareRequest{
		Target:   share.TargetGroup,
		TargetID: groupID,
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusAccepted, rr.Body.String())
	}

	history, err := f.chatRepo.GetGroupHistory(groupID, 10, 0)
	if err != nil {
		t.Fatalf("GetGroupHistory: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("expected no message delivered by a non-member, got %d", len(history))
	}
}

func TestSharePost_NonExistentPost_Returns404(t *testing.T) {
	f := setup(t)
	sender := f.newUser(t, "sharesender6")
	recipient := f.newUser(t, "sharerecipient6")

	req := shareRequest(t, sender, 999999, share.ShareRequest{
		Target:   share.TargetUser,
		TargetID: int64(recipient),
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNotFound, rr.Body.String())
	}
}

func TestSharePost_InvalidTarget_Returns400(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor7")
	sender := f.newUser(t, "sharesender7")
	postID := f.newPublicPost(t, author)

	req := shareRequest(t, sender, postID, share.ShareRequest{
		Target:   "email",
		TargetID: 1,
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusBadRequest, rr.Body.String())
	}
}

func TestSharePost_MissingTargetID_Returns400(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor8")
	sender := f.newUser(t, "sharesender8")
	postID := f.newPublicPost(t, author)

	req := shareRequest(t, sender, postID, share.ShareRequest{
		Target: share.TargetUser,
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusBadRequest, rr.Body.String())
	}
}

func TestSharePost_Unauthenticated_Returns401(t *testing.T) {
	f := setup(t)
	author := f.newUser(t, "shareauthor9")
	recipient := f.newUser(t, "sharerecipient9")
	postID := f.newPublicPost(t, author)

	req := shareRequest(t, 0, postID, share.ShareRequest{
		Target:   share.TargetUser,
		TargetID: int64(recipient),
	})
	rr := httptest.NewRecorder()
	f.shareHandler.SharePostHandler(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusUnauthorized, rr.Body.String())
	}
}
