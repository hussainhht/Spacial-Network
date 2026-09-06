package groups

import "time"


const (
	EventResponseGoing    = "going"
	EventResponseNotGoing = "not_going"
)

type Event struct {
	ID          int       `db:"id"`
	GroupID     int       `db:"group_id"`
	CreatedBy   int       `db:"created_by"`
	Title       string    `db:"title"`
	Description string    `db:"description"`
	EventTime   time.Time `db:"event_time"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`

	// CurrentUserResponse is populated by the service layer for the event
	// details endpoint; it is not a column on the events table.
	CurrentUserResponse *string
}

type CreateEventRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	EventTime   string `json:"event_time"`
}

type CreateEventResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	EventID int64  `json:"event_id,omitempty"`
}

type EventResponse struct {
	CurrentUserResponse *string `json:"current_user_response,omitempty"`
	Title               string  `json:"title"`
	Description         string  `json:"description"`
	EventTime           string  `json:"event_time"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
	ID                  int     `json:"id"`
	GroupID             int     `json:"group_id"`
	CreatedBy           int     `json:"created_by"`
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
