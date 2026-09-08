package groups

import (
	"log"
	"time"

	"social/internal/notifications"
)

// CreateEvent creates a new event in a group. Only an existing group member
// may create an event; the creator is taken from the authenticated session,
// never from client input. eventTime must be in the future - this is the
// authoritative check, independent of whatever validation already ran in the
// handler, since the service is what actually owns the business rule.
func (s *Service) CreateEvent(groupID, userID int, title, description string, eventTime time.Time) (int64, error) {
	if !eventTime.After(time.Now()) {
		return 0, ErrEventTimeInPast
	}

	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return 0, err
	}

	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return 0, err
	}
	if member == nil {
		return 0, ErrNotGroupMember
	}

	eventID, err := s.repo.InsertEvent(groupID, userID, title, description, eventTime)
	if err != nil {
		return 0, err
	}

	s.notifyGroupMembers(groupID, userID, eventID)

	return eventID, nil
}

// notifyGroupMembers tells every other group member that a new event was
// created, using the existing group_event notification type.
func (s *Service) notifyGroupMembers(groupID, actorID int, eventID int64) {
	members, err := s.repo.GetGroupMembers(groupID)
	if err != nil {
		log.Printf("groups: failed to load members to notify for event %d: %v", eventID, err)
		return
	}

	for _, m := range members {
		if m.UserID == actorID {
			continue
		}
		s.notify(
			m.UserID, // receiver
			actorID,  // actor
			notifications.NotificationGroupEvent,
			notifications.EntityEvent,
			int(eventID),
			"created a new event in your group",
		)
	}
}

// GetGroupEvents returns the events belonging to a group, ordered by
// event_time. Only group members may access this.
func (s *Service) GetGroupEvents(groupID, userID int) ([]Event, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}

	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrNotGroupMember
	}

	return s.repo.GetEventsByGroup(groupID, userID)
}

// GetEventDetails returns a single event, verifying that it belongs to the
// requested group and that the requesting user is a member of that group.
// The current user's response, if any, is attached to the result.
func (s *Service) GetEventDetails(groupID, eventID, userID int) (*Event, error) {
	event, err := s.repo.GetEventByID(eventID, userID)
	if err != nil {
		return nil, err
	}
	if event.GroupID != groupID {
		return nil, ErrEventNotFound
	}

	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrNotGroupMember
	}

	return event, nil
}

// RespondToEvent records or updates the authenticated user's response to an
// event. Only a member of the event's group may respond.
func (s *Service) RespondToEvent(groupID, eventID, userID int, response string) error {
	validated, err := ValidateEventResponseStatus(response)
	if err != nil {
		return err
	}
	response = validated
	if _, err := s.GetEventDetails(groupID, eventID, userID); err != nil {
		return err
	}

	if err := s.repo.UpsertEventResponse(eventID, userID, response); err != nil {
		return err
	}

	s.broadcastEventResponseUpdate(groupID, eventID, userID, response)

	return nil
}

// Reuse the event details access rules for response lists as well as writes.
func (s *Service) GetEventResponses(groupID, eventID, userID int) ([]EventResponseUser, error) {
	if _, err := s.GetEventDetails(groupID, eventID, userID); err != nil {
		return nil, err
	}
	return s.repo.GetEventResponses(eventID)
}
