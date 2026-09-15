package followers

import (
	"log"

	"social/internal/websocket"
)

// EventFollowRemoved is pushed to whichever user just lost a follow
// relationship or a pending request they'd sent - either because the other
// side unfollowed them, or because their follow request was declined. This
// is ephemeral realtime sync (so an open profile page's follow button and
// lists stay correct without a manual refresh) and, unlike
// internal/notifications, is deliberately NOT persisted or shown in the
// notification inbox - unfollows and declines are expected to stay quiet,
// matching most social products.
const EventFollowRemoved websocket.EventType = "follow_removed"

// FollowRemovedReason identifies why a follow relationship or pending
// request went away.
type FollowRemovedReason string

const (
	FollowRemovedUnfollowed FollowRemovedReason = "unfollowed"
	FollowRemovedDeclined   FollowRemovedReason = "declined"
)

type FollowRemovedPayload struct {
	// ActorID is whoever caused the change - the user who unfollowed, or
	// who declined the request.
	ActorID int                 `json:"actor_id"`
	Reason  FollowRemovedReason `json:"reason"`
}

// broadcastFollowRemoved tells receiverID that actorID just unfollowed them
// or declined their follow request. It must only be called after that
// change has already been persisted successfully.
func (s *Service) broadcastFollowRemoved(receiverID, actorID int, reason FollowRemovedReason) {
	if s.hub == nil {
		return
	}

	event, err := websocket.NewEvent(EventFollowRemoved, FollowRemovedPayload{
		ActorID: actorID,
		Reason:  reason,
	})
	if err != nil {
		log.Printf("followers: failed to build follow_removed event: %v", err)
		return
	}

	s.hub.SendToUser(int64(receiverID), event)
}
