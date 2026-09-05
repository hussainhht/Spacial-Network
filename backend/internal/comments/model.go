package comments

import (
	"database/sql"
	"time"
)

type comment struct {
	ID         int
	PostID     int
	UserID     int
	Content    string
	ImagePath  sql.NullString
	Created_At time.Time
	Updated_At time.Time
}
