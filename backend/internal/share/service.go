package share

import (
	"encoding/json"
	"strconv"
	"strings"

	"social/internal/chat"
	"social/internal/posts"
)

// MessageSender is the slice of the chat service this package needs:
// somewhere to hand a composed message for delivery. Declared here as an
// interface (rather than depending on *chat.Service directly) so sharing
// stays decoupled from how chat persists and broadcasts - the same way
// chat itself depends on followers and groups only through its own
// narrow interfaces.
//
// Both methods mirror chat's WebSocket entry points: they validate the
// recipient, enforce chat's own permission rules (you may only DM users
// you follow or who follow you; you may only post to groups you belong
// to), persist the message, broadcast it over the hub, and notify the
// recipient. A share therefore cannot reach anyone the sender could not
// already message directly.
type MessageSender interface {
	HandlePrivateMessage(senderID int64, rawPayload json.RawMessage)
	HandleGroupMessage(senderID int64, rawPayload json.RawMessage)
}

// PostViewChecker is the slice of the posts service this package needs:
// whether the sharing user is allowed to see the post at all.
type PostViewChecker interface {
	CanAccess(viewerID, postID int) (bool, error)
}

type Service struct {
	sender       MessageSender
	postsService PostViewChecker
}

func NewService(sender MessageSender, postsService PostViewChecker) *Service {
	return &Service{
		sender:       sender,
		postsService: postsService,
	}
}

// SharePost sends a link to postID as an in-site chat message - a direct
// message when target is TargetUser, or a group message when it is
// TargetGroup. target, targetID and note are expected to have already
// been through this package's Validate* helpers, the way the handler
// validates a request before calling in.
//
// The sender must be able to view the post; the recipient check is
// chat's, applied when the message is handed over.
//
// Delivery is asynchronous: chat reports a rejected recipient to the
// sender over the WebSocket error channel rather than back through this
// call, so a nil return means the share was accepted for delivery, not
// that it was delivered.
func (s *Service) SharePost(userID, postID int, target string, targetID int64, note string) error {
	canAccess, err := s.postsService.CanAccess(userID, postID)
	if err != nil {
		return err
	}
	if !canAccess {
		return ErrPostNotFound
	}

	sh := &share{
		SenderID: int64(userID),
		Target:   target,
		TargetID: targetID,
		Content:  composeMessage(postID, note),
	}

	return s.deliver(sh)
}

// deliver hands the composed share to chat on the route its target calls
// for.
func (s *Service) deliver(sh *share) error {
	switch sh.Target {
	case TargetUser:
		payload, err := json.Marshal(chat.MessagePayload{
			RecipientID: sh.TargetID,
			Content:     sh.Content,
		})
		if err != nil {
			return err
		}
		s.sender.HandlePrivateMessage(sh.SenderID, payload)

	case TargetGroup:
		payload, err := json.Marshal(chat.GroupMessagePayload{
			GroupID: sh.TargetID,
			Content: sh.Content,
		})
		if err != nil {
			return err
		}
		s.sender.HandleGroupMessage(sh.SenderID, payload)

	default:
		return ErrInvalidTarget
	}

	return nil
}

// composeMessage renders the chat message body for a shared post: the
// sender's optional note followed by the post's in-site link. The link is
// a relative app path, never an absolute URL to an external host - a
// share stays inside the site.
func composeMessage(postID int, note string) string {
	link := PostLink(postID)
	if note == "" {
		return link
	}

	var b strings.Builder
	b.WriteString(note)
	b.WriteString("\n")
	b.WriteString(link)

	return b.String()
}

// PostLink is the in-site path a shared post resolves to, matching the
// frontend's /posts/[id] route.
func PostLink(postID int) string {
	return "/posts/" + strconv.Itoa(postID)
}

// Compile-time checks that the real chat and posts services satisfy the
// narrow interfaces this package depends on - sharing reuses them as they
// already are, and these break the build if either drifts.
var (
	_ MessageSender   = (*chat.Service)(nil)
	_ PostViewChecker = (*posts.Service)(nil)
)
