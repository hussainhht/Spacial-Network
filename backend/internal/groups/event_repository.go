package groups

import (
	"database/sql"
	"time"
)

func (r *Repository) InsertEvent(groupID, createdBy int, title, description string, eventTime time.Time) (int64, error) {
	return r.InsertEventWithImage(groupID, createdBy, title, description, eventTime, sql.NullString{})
}

func (r *Repository) InsertEventWithImage(groupID, createdBy int, title, description string, eventTime time.Time, imagePath sql.NullString) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO events (group_id, created_by, title, description, event_time, image_path) VALUES (?, ?, ?, ?, ?, ?)`,
		groupID,
		createdBy,
		title,
		description,
		eventTime,
		imagePath,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// The existing unique (event_id, user_id) index supports both the current
// user's lookup and counts. All event summaries are read in one SQL query.
const eventSummarySelect = `SELECT e.id, e.group_id, e.created_by, e.title, e.description,
 e.event_time, e.image_path, e.created_at, e.updated_at, mine.response,
 (SELECT COUNT(*) FROM event_responses er WHERE er.event_id = e.id AND er.response = 'going'),
 (SELECT COUNT(*) FROM event_responses er WHERE er.event_id = e.id AND er.response = 'not_going')
 FROM events e
 LEFT JOIN event_responses mine ON mine.event_id = e.id AND mine.user_id = ? `

func (r *Repository) GetEventsByGroup(groupID, userID int) ([]Event, error) {
	rows, err := r.db.Query(
		eventSummarySelect+`WHERE e.group_id = ? ORDER BY e.event_time ASC, e.id ASC`,
		userID, groupID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Event, 0)
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.GroupID, &e.CreatedBy, &e.Title, &e.Description, &e.EventTime, &e.ImagePath, &e.CreatedAt, &e.UpdatedAt, &e.CurrentUserResponse, &e.GoingCount, &e.NotGoingCount); err != nil {
			return nil, err
		}
		result = append(result, e)
	}

	return result, rows.Err()
}

func (r *Repository) GetEventByID(eventID, userID int) (*Event, error) {
	var e Event

	err := r.db.QueryRow(
		eventSummarySelect+`WHERE e.id = ?`,
		userID, eventID,
	).Scan(&e.ID, &e.GroupID, &e.CreatedBy, &e.Title, &e.Description, &e.EventTime, &e.ImagePath, &e.CreatedAt, &e.UpdatedAt, &e.CurrentUserResponse, &e.GoingCount, &e.NotGoingCount)
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

func (r *Repository) GetEventResponses(eventID int) ([]EventResponseUser, error) {
	rows, err := r.db.Query(`SELECT er.user_id, u.username, COALESCE(u.profile_photo, ''), er.response
 FROM event_responses er JOIN users u ON u.id = er.user_id
 WHERE er.event_id = ? ORDER BY u.username ASC, er.user_id ASC`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]EventResponseUser, 0)
	for rows.Next() {
		var user EventResponseUser
		if err := rows.Scan(&user.UserID, &user.Username, &user.Avatar, &user.Response); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}
