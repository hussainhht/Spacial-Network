package posts

import "time"

type post struct {
	ID         int       `db:"id"`
	User_ID    int       `db:"user_id"`
	isPrivate  bool      `db:"private"`
	Title      string    `db:"title"`
	Content    string    `db:"content"`
	Created_At time.Time `db:"created_at"`
	Updated_At time.Time `db:"updated_at"`
}
