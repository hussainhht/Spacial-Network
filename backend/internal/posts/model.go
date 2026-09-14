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

// Feed scopes for ListPosts - which authors' posts are candidates before
// the usual visibility rules are applied.
const (
	// FeedAll is the default: every post the viewer is authorized to see.
	FeedAll = "all"
	// FeedFollowing restricts candidates to authors the viewer follows.
	FeedFollowing = "following"
	// FeedFriends restricts candidates to authors in a mutual follow with
	// the viewer (the viewer follows them and they follow the viewer back).
	FeedFriends = "friends"
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
