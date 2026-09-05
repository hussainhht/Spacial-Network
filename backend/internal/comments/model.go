package comments

import "time"

type comment struct {
	ID         int
	PostID     int
	UserID     int
	Content    string
	Created_At time.Time
	Updated_At time.Time
}
