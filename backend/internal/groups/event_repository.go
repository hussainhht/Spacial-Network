package groups

import (
	"database/sql"
	"time"
)

func (r *Repository) InsertEvent(groupID, createdBy int, title, description string, eventTime time.Time) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO events (group_id, created_by, title, description, event_time) VALUES (?, ?, ?, ?, ?)`,
		groupID,
		createdBy,
		title,
		description,
		eventTime,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetEventsByGroup(groupID int) ([]Event, error) {
	rows, err := r.db.Query(
		`SELECT id, group_id, created_by, title, description, event_time, created_at, updated_at
		 FROM events
		 WHERE group_id = ?
		 ORDER BY event_time ASC, id ASC`,
		groupID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Event, 0)
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.GroupID, &e.CreatedBy, &e.Title, &e.Description, &e.EventTime, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, e)
	}

	return result, rows.Err()
}

func (r *Repository) GetEventByID(eventID int) (*Event, error) {
	var e Event

	err := r.db.QueryRow(
		`SELECT id, group_id, created_by, title, description, event_time, created_at, updated_at
		 FROM events
		 WHERE id = ?`,
		eventID,
	).Scan(&e.ID, &e.GroupID, &e.CreatedBy, &e.Title, &e.Description, &e.EventTime, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrEventNotFound
		}
		return nil, err
	}

	return &e, nil
}

// GetUserEventResponse returns the given user's response to an event, or nil
// if they haven't responded yet.
func (r *Repository) GetUserEventResponse(eventID, userID int) (*string, error) {
	var response string

	err := r.db.QueryRow(
		`SELECT response FROM event_responses WHERE event_id = ? AND user_id = ?`,
		eventID,
		userID,
	).Scan(&response)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &response, nil
}

// UpsertEventResponse creates or updates the given user's response to an
// event, relying on the UNIQUE(event_id, user_id) constraint so a user only
// ever has one response row per event.
func (r *Repository) UpsertEventResponse(eventID, userID int, response string) error {
	_, err := r.db.Exec(
		`INSERT INTO event_responses (event_id, user_id, response)
		 VALUES (?, ?, ?)
		 ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, updated_at = CURRENT_TIMESTAMP`,
		eventID,
		userID,
		response,
	)
	return err
}
