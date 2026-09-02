package chat

import (
	"time"

	"social/internal/websocket"
)

const (
	EventPrivateMessage websocket.EventType = "private_message"
	EventTyping         websocket.EventType = "typing"
)

type PrivateMessage struct {
	ID          int64      `json:"id"`
	SenderID    int64      `json:"sender_id"`
	RecipientID int64      `json:"recipient_id"`
	Content     string     `json:"content"`
	CreatedAt   time.Time  `json:"created_at"`
	ReadAt      *time.Time `json:"read_at,omitempty"`
}

type MessagePayload struct {
	ID          int64  `json:"id,omitempty"`
	SenderID    int64  `json:"sender_id"`
	RecipientID int64  `json:"recipient_id"`
	Content     string `json:"content"`
	CreatedAt   string `json:"created_at,omitempty"`
}

type TypingPayload struct {
	SenderID    int64 `json:"sender_id"`
	RecipientID int64 `json:"recipient_id"`
	IsTyping    bool  `json:"is_typing"`
}

type ConversationSummary struct {
	PartnerID        int64  `json:"partner_id"`
	PartnerUsername  string `json:"partner_username"`
	PartnerFirstName string `json:"partner_first_name"`
	PartnerLastName  string `json:"partner_last_name"`
	PartnerAvatar    string `json:"partner_avatar,omitempty"`
	LastMessage      string `json:"last_message"`
	LastMessageAt    string `json:"last_message_at"`
	UnreadCount      int    `json:"unread_count"`
}
