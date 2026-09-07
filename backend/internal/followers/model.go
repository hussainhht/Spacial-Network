package followers

import "time"

type Follow struct {
	ID         int       `db:"id"`
	FollowerID int       `db:"follower_id"`
	FollowedID int       `db:"followed_id"`
	CreatedAt  time.Time `db:"created_at"`
}

type UserSummary struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	ProfilePhoto string `json:"profile_photo,omitempty"`
}

type FollowListResponse struct {
	Success bool          `json:"success"`
	Message string        `json:"message,omitempty"`
	Users   []UserSummary `json:"users"`
}
