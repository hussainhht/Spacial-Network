package notifications

import "log"

type Service struct {
	repo   *Repository
	sender NotificationSender
}


func NewService(repo *Repository, sender NotificationSender) *Service {
	return &Service{repo: repo, sender: sender}
}


func (s *Service) Create(req CreateNotificationRequest) (*Notification, error) {
	if !IsValidNotificationType(req.Type) {
		return nil, ErrInvalidNotificationType
	}

	n, err := s.repo.Create(req)
	if err != nil {
		return nil, err
	}

	s.deliver(*n)

	return n, nil
}

func (s *Service) deliver(n Notification) {
	if s.sender == nil {
		return
	}

	event, err := NewNotificationEvent(n)
	if err != nil {
		log.Printf("notifications: failed to build event for notification %d: %v", n.ID, err)
		return
	}

	if err := s.sender.SendToUser(n.ReceiverID, event); err != nil {
		log.Printf("notifications: websocket delivery failed for user %d (notification %d): %v", n.ReceiverID, n.ID, err)
	}
}

// GetForUser returns a page of userID's notifications, newest first.
func (s *Service) GetForUser(userID, limit, offset int) ([]Notification, error) {
	if limit <= 0 || limit > MaxListLimit {
		limit = DefaultListLimit
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.GetByUser(userID, limit, offset)
}

// GetUnreadCount returns how many of userID's notifications are unread.
func (s *Service) GetUnreadCount(userID int) (int, error) {
	return s.repo.GetUnreadCount(userID)
}

// MarkAsRead marks one notification read, provided it belongs to
// receiverID. See Repository.MarkAsRead for the ownership check.
func (s *Service) MarkAsRead(notificationID, receiverID int) error {
	return s.repo.MarkAsRead(notificationID, receiverID)
}

// MarkAllAsRead marks every unread notification belonging to receiverID as
// read.
func (s *Service) MarkAllAsRead(receiverID int) error {
	return s.repo.MarkAllAsRead(receiverID)
}
