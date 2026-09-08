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

type FollowResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

type FollowStatusResponse struct {
	Success     bool   `json:"success"`
	Message     string `json:"message,omitempty"`
	IsFollowing bool   `json:"is_following"`
}

const (
	FollowRequestStatusPending  = "pending"
	FollowRequestStatusAccepted = "accepted"
	FollowRequestStatusDeclined = "declined"
)

type FollowRequest struct {
	ID          int       `db:"id"`
	RequesterID int       `db:"requester_id"`
	TargetID    int       `db:"target_id"`
	Status      string    `db:"status"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type FollowRequestWithRequester struct {
	ID        int
	Requester UserSummary
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type FollowRequestResponse struct {
	ID        int         `json:"id"`
	Requester UserSummary `json:"requester"`
	Status    string      `json:"status"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

type FollowRequestsResponse struct {
	Success  bool                    `json:"success"`
	Message  string                  `json:"message,omitempty"`
	Requests []FollowRequestResponse `json:"requests"`
}
