package chat

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"social/internal/notifications"
	"social/internal/websocket"
)

const (
	MaxMessageLength = 2000
)

var (
	ErrEmptyMessage    = errors.New("message cannot be empty")
	ErrMessageTooLong  = errors.New("message exceeds maximum allowed length")
	ErrInvalidReceiver = errors.New("invalid message recipient")
	ErrSelfMessage     = errors.New("cannot send a message to yourself")
)

type NotificationSender interface {
	Notify(notifications.CreateNotificationRequest) error
}

type Service struct {
	repo     *Repository
	hub      *websocket.Hub
	notifier NotificationSender
}

func NewService(repo *Repository, hub *websocket.Hub, notifier NotificationSender) *Service {
	return &Service{
		repo:     repo,
		hub:      hub,
		notifier: notifier,
	}
}

// RegisterWSRoutes registers all chat WebSocket event handlers with the given WebSocket router.
func (s *Service) RegisterWSRoutes(r *websocket.Router) {
	r.Register(EventPrivateMessage, s.HandlePrivateMessage)
	r.Register(EventTyping, s.HandleTyping)
	r.Register(EventMarkRead, s.HandleMarkRead)
}

func (s *Service) HandleIncomingWSMessage(senderID int64, raw []byte) {
	var event websocket.Event
	if err := json.Unmarshal(raw, &event); err != nil {
		log.Printf("chat ws unmarshal error from user %d: %v", senderID, err)
		return
	}

	switch event.Type {
	case EventPrivateMessage:
		s.HandlePrivateMessage(senderID, event.Payload)

	case EventTyping:
		s.HandleTyping(senderID, event.Payload)

	case EventMarkRead:
		s.HandleMarkRead(senderID, event.Payload)
	}
}

func (s *Service) HandlePrivateMessage(senderID int64, rawPayload json.RawMessage) {
	var req MessagePayload
	if err := json.Unmarshal(rawPayload, &req); err != nil {
		s.sendError(senderID, "Invalid message payload format")
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		s.sendError(senderID, ErrEmptyMessage.Error())
		return
	}

	if utf8.RuneCountInString(content) > MaxMessageLength {
		s.sendError(senderID, fmt.Sprintf("Message too long (max %d characters)", MaxMessageLength))
		return
	}

	if req.RecipientID <= 0 {
		s.sendError(senderID, ErrInvalidReceiver.Error())
		return
	}

	if senderID == req.RecipientID {
		s.sendError(senderID, ErrSelfMessage.Error())
		return
	}

	if s.repo != nil {
		exists, err := s.repo.UserExists(req.RecipientID)
		if err != nil {
			log.Printf("failed to check recipient existence: %v", err)
			s.sendError(senderID, "Internal server error")
			return
		}
		if !exists {
			s.sendError(senderID, "Recipient does not exist")
			return
		}
	}

	savedMsg, err := s.repo.SavePrivateMessage(senderID, req.RecipientID, content)
	if err != nil {
		log.Printf("failed to save private message: %v", err)
		s.sendError(senderID, "Failed to save message")
		return
	}

	outPayload := MessagePayload{
		ID:          savedMsg.ID,
		SenderID:    savedMsg.SenderID,
		RecipientID: savedMsg.RecipientID,
		Content:     savedMsg.Content,
		CreatedAt:   savedMsg.CreatedAt.UTC().Format(time.RFC3339),
	}

	outEvent, err := websocket.NewEvent(EventPrivateMessage, outPayload)
	if err != nil {
		log.Printf("failed to create message event: %v", err)
		return
	}

	s.hub.SendToUser(savedMsg.RecipientID, outEvent)
	s.hub.SendToUser(savedMsg.SenderID, outEvent)

	if s.notifier != nil {
		actorID := int(senderID)
		msgID := int(savedMsg.ID)
		entityType := notifications.EntityPrivateMessage
		preview := content
		if utf8.RuneCountInString(preview) > 60 {
			runes := []rune(preview)
			preview = string(runes[:60]) + "..."
		}
		if err := s.notifier.Notify(notifications.CreateNotificationRequest{
			ReceiverID: int(savedMsg.RecipientID),
			ActorID:    &actorID,
			Type:       notifications.NotificationPrivateMessage,
			EntityType: &entityType,
			EntityID:   &msgID,
			Message:    preview,
		}); err != nil {
			log.Printf("chat: failed to create notification for user %d: %v", savedMsg.RecipientID, err)
		}
	}
}

func (s *Service) HandleTyping(senderID int64, rawPayload json.RawMessage) {
	var payload TypingPayload
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return
	}

	if payload.RecipientID <= 0 || payload.RecipientID == senderID {
		return
	}

	payload.SenderID = senderID
	outEvent, err := websocket.NewEvent(EventTyping, payload)
	if err != nil {
		return
	}

	s.hub.SendToUser(payload.RecipientID, outEvent)
}

func (s *Service) HandleMarkRead(readerID int64, rawPayload json.RawMessage) {
	var payload MarkReadPayload
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return
	}

	if payload.SenderID <= 0 || payload.SenderID == readerID {
		return
	}

	if err := s.repo.MarkMessagesAsRead(payload.SenderID, readerID); err != nil {
		log.Printf("failed to mark messages as read: %v", err)
		return
	}

	readAt := time.Now().UTC().Format(time.RFC3339)
	outPayload := MessagesReadPayload{
		ReaderID: readerID,
		SenderID: payload.SenderID,
		ReadAt:   readAt,
	}

	outEvent, err := websocket.NewEvent(EventMessagesRead, outPayload)
	if err != nil {
		return
	}

	s.hub.SendToUser(payload.SenderID, outEvent)
	s.hub.SendToUser(readerID, outEvent)
}

func (s *Service) GetHistory(userA, userB int64, limit, offset int) ([]PrivateMessage, error) {
	if userB <= 0 {
		return nil, ErrInvalidReceiver
	}
	if err := s.repo.MarkMessagesAsRead(userB, userA); err != nil {
		log.Printf("failed to mark messages as read: %v", err)
	} else if s.hub != nil {
		readAt := time.Now().UTC().Format(time.RFC3339)
		outPayload := MessagesReadPayload{
			ReaderID: userA,
			SenderID: userB,
			ReadAt:   readAt,
		}
		if outEvent, err := websocket.NewEvent(EventMessagesRead, outPayload); err == nil {
			s.hub.SendToUser(userB, outEvent)
			s.hub.SendToUser(userA, outEvent)
		}
	}

	return s.repo.GetPrivateHistory(userA, userB, limit, offset)
}

func (s *Service) GetRecentConversations(userID int64) ([]ConversationSummary, error) {
	return s.repo.GetRecentConversations(userID)
}

func (s *Service) sendError(userID int64, message string) {
	event, err := websocket.NewEvent(websocket.EventError, websocket.ErrorPayload{
		Message: message,
	})
	if err != nil {
		return
	}

	s.hub.SendToUser(userID, event)
}
