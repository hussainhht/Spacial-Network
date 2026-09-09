package posts

import (
	"database/sql"
	"time"
)

const (
	VisibilityPublic    = "public"
	VisibilityFollowers = "followers"
	VisibilityCustom    = "custom"
)

type post struct {
	ID         int            `db:"id"`
	User_ID    int            `db:"user_id"`
	visibility string         `db:"visibility"`
	Title      string         `db:"title"`
	Content    string         `db:"content"`
	ImagePath  sql.NullString `db:"image_path"`
	GroupID    sql.NullInt64  `db:"group_id"`
	Created_At time.Time      `db:"created_at"`
	Updated_At time.Time      `db:"updated_at"`
}
