package groups

import (
	"database/sql"
	"time"
)

const (
	EventResponseGoing    = "going"
	EventResponseNotGoing = "not_going"
)

type Event struct {
	ID          int            `db:"id"`
	GroupID     int            `db:"group_id"`
	CreatedBy   int            `db:"created_by"`
	Title       string         `db:"title"`
	Description string         `db:"description"`
	EventTime   time.Time      `db:"event_time"`
	ImagePath   sql.NullString `db:"image_path"`
	CreatedAt   time.Time      `db:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at"`

	// Response summary is read from event_responses, not stored on events.
	CurrentUserResponse *string
	GoingCount          int
	NotGoingCount       int
}

type CreateEventRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	EventTime   string `json:"event_time"`
}

type CreateEventResponse struct {
	Success   bool    `json:"success"`
	Message   string  `json:"message"`
	EventID   int64   `json:"event_id,omitempty"`
	ImagePath *string `json:"image_path,omitempty"`
}

type EventResponse struct {
	GoingCount          int     `json:"going_count"`
	NotGoingCount       int     `json:"not_going_count"`
	CurrentUserResponse *string `json:"current_user_response"`
	Title               string  `json:"title"`
	Description         string  `json:"description"`
	EventTime           string  `json:"event_time"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
	ID                  int     `json:"id"`
	GroupID             int     `json:"group_id"`
	CreatedBy           int     `json:"created_by"`
	ImagePath           *string `json:"image_path"`
}

type ListEventsResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message,omitempty"`
	Events  []EventResponse `json:"events,omitempty"`
}

type GetEventResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message,omitempty"`
	Event   *EventResponse `json:"event,omitempty"`
}

type RespondToEventRequest struct {
	Response string `json:"response"`
}

// EventResponseUser exposes only the public identity needed by attendee lists.
type EventResponseUser struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar,omitempty"`
	Response string `json:"response"`
}

type ListEventResponsesResponse struct {
	Success   bool                `json:"success"`
	Message   string              `json:"message,omitempty"`
	Responses []EventResponseUser `json:"responses"`
}
