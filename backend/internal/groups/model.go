package groups

import "time"

type Group struct {
	ID          int       `db:"id"`
	CreatorID   int       `db:"creator_id"`
	Title       string    `db:"title"`
	Description string    `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type GroupMember struct {
	UserID   int       `db:"user_id"`
	Username string    `db:"username"`
	Role     string    `db:"role"`
	JoinedAt time.Time `db:"joined_at"`
}
