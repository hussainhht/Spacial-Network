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
