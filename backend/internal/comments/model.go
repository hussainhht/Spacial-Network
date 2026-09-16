package comments

import (
	"database/sql"
	"time"

	"social/internal/users"
)

type comment struct {
	ID         int
	PostID     int
	UserID     int
	Content    string
	ImagePath  sql.NullString
	Created_At time.Time
	Updated_At time.Time
	Author     users.Summary
}
