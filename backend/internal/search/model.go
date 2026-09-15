package search

import "time"

type UserResult struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	ProfilePhoto string `json:"profile_photo"`
	IsPrivate    bool   `json:"is_private"`
	IsFollowing  bool   `json:"is_following"`
}

type GroupResult struct {
	ID             int    `json:"id"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	GroupPhoto     string `json:"group_photo"`
	MemberCount    int    `json:"member_count"`
	MembershipRole string `json:"membership_role"`
}

type PostResult struct {
	ID             int       `json:"id"`
	Title          string    `json:"title"`
	ContentSnippet string    `json:"content_snippet"`
	AuthorID       int       `json:"author_id"`
	AuthorUsername string    `json:"author_username"`
	AuthorPhoto    string    `json:"author_photo"`
	GroupID        *int      `json:"group_id"`
	GroupTitle     string    `json:"group_title"`
	CreatedAt      time.Time `json:"created_at"`
}

type EventResult struct {
	ID          int       `json:"id"`
	GroupID     int       `json:"group_id"`
	GroupTitle  string    `json:"group_title"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	EventTime   time.Time `json:"event_time"`
}

type SearchResults struct {
	Query  string        `json:"query"`
	Users  []UserResult  `json:"users"`
	Groups []GroupResult `json:"groups"`
	Posts  []PostResult  `json:"posts"`
	Events []EventResult `json:"events"`
}
