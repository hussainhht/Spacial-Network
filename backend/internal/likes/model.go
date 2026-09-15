package likes

import "time"

type like struct {
	ID         int
	PostID     int
	UserID     int
	Created_At time.Time
}

// LikeStatus is the per-post like state for a single viewer: how many
// likes the post has in total, and whether the viewer is one of them.
// Kept together because the two are always read as a pair when rendering
// a post's like button.
type LikeStatus struct {
	PostID int
	Count  int
	Liked  bool
}
