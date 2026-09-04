package chat

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"unicode/utf8"

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

type Service struct {
	repo *Repository
	hub  *websocket.Hub
}

func NewService(repo *Repository, hub *websocket.Hub) *Service {
	return &Service{
		repo: repo,
		hub:  hub,
	}
}

func (s *Service) HandleIncomingWSMessage(senderID int64, raw []byte) {
	var event websocket.Event
	if err := json.Unmarshal(raw, &event); err != nil {
		log.Printf("chat ws unmarshal error from user %d: %v", senderID, err)
		return
	}

	switch event.Type {
	case EventPrivateMessage:
		s.handlePrivateMessage(senderID, event.Payload)

	case EventTyping:
		s.handleTyping(senderID, event.Payload)
	}
}

func (s *Service) handlePrivateMessage(senderID int64, rawPayload json.RawMessage) {
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
		CreatedAt:   savedMsg.CreatedAt.Format("2006-01-02 15:04:05"),
	}

	outEvent, err := websocket.NewEvent(EventPrivateMessage, outPayload)
	if err != nil {
		log.Printf("failed to create message event: %v", err)
		return
	}

	s.hub.SendToUser(savedMsg.RecipientID, outEvent)
	s.hub.SendToUser(savedMsg.SenderID, outEvent)
}
func (s *Service) handleTyping(senderID int64, rawPayload json.RawMessage) {
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

func (s *Service) GetHistory(userA, userB int64, limit, offset int) ([]PrivateMessage, error) {
	if userB <= 0 {
		return nil, ErrInvalidReceiver
	}
	if err := s.repo.MarkMessagesAsRead(userB, userA); err != nil {
		log.Printf("failed to mark messages as read: %v", err)
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
