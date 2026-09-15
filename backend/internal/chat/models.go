package chat

import (
	"time"

	"social/internal/websocket"
)

const (
	EventPrivateMessage websocket.EventType = "private_message"
	EventGroupMessage   websocket.EventType = "group_message"
	EventTyping         websocket.EventType = "typing"
	EventMarkRead       websocket.EventType = "mark_read"
	EventMessagesRead   websocket.EventType = "messages_read"
)

type PrivateMessage struct {
	ID              int64      `json:"id"`
	SenderID        int64      `json:"sender_id"`
	RecipientID     int64      `json:"recipient_id"`
	SenderUsername  string     `json:"sender_username,omitempty"`
	SenderFirstName string     `json:"sender_first_name,omitempty"`
	SenderLastName  string     `json:"sender_last_name,omitempty"`
	SenderAvatar    string     `json:"sender_avatar,omitempty"`
	Content         string     `json:"content"`
	CreatedAt       time.Time  `json:"created_at"`
	ReadAt          *time.Time `json:"read_at,omitempty"`
}

type GroupMessage struct {
	ID        int64     `json:"id"`
	GroupID   int64     `json:"group_id"`
	UserID    int64     `json:"user_id"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Avatar    string    `json:"avatar,omitempty"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type GroupMessagePayload struct {
	ID        int64  `json:"id,omitempty"`
	GroupID   int64  `json:"group_id"`
	UserID    int64  `json:"user_id"`
	Username  string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Avatar    string `json:"avatar,omitempty"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at,omitempty"`
}

type MessagePayload struct {
	ID              int64  `json:"id,omitempty"`
	SenderID        int64  `json:"sender_id"`
	RecipientID     int64  `json:"recipient_id"`
	SenderUsername  string `json:"sender_username,omitempty"`
	SenderFirstName string `json:"sender_first_name,omitempty"`
	SenderLastName  string `json:"sender_last_name,omitempty"`
	SenderAvatar    string `json:"sender_avatar,omitempty"`
	Content         string `json:"content"`
	CreatedAt       string `json:"created_at,omitempty"`
}

type TypingPayload struct {
	SenderID    int64 `json:"sender_id"`
	RecipientID int64 `json:"recipient_id"`
	IsTyping    bool  `json:"is_typing"`
}

type MarkReadPayload struct {
	SenderID int64 `json:"sender_id"`
}

type MessagesReadPayload struct {
	ReaderID int64  `json:"reader_id"`
	SenderID int64  `json:"sender_id"`
	ReadAt   string `json:"read_at"`
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
