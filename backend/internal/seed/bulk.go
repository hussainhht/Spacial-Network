package seed

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// RunBulk adds a deterministic, repeat-safe social graph around the existing
// development accounts. Existing rows are never deleted or updated.
func RunBulk(db *sql.DB, postCount int) error {
	if postCount < 1 {
		return fmt.Errorf("bulk post count must be positive")
	}

	userCount := postCount / 4
	if userCount < 60 {
		userCount = 60
	}
	if userCount > 120 {
		userCount = 120
	}
	groupCount := postCount / 12
	if groupCount < 18 {
		groupCount = 18
	}
	if groupCount > 36 {
		groupCount = 36
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("Password123!"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bulk user password: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin bulk seed: %w", err)
	}
	defer tx.Rollback()
	now := time.Now().UTC()

	userIDs := make([]int, userCount)
	for i := 0; i < userCount; i++ {
		username := fmt.Sprintf("seed_explorer_%03d", i+1)
		created := now.Add(-time.Duration(userCount-i) * 6 * time.Hour)
		_, err := tx.Exec(`
			INSERT OR IGNORE INTO users
				(uuid, username, age, gender, first_name, last_name, email, password_hash,
				 is_private, nickname, about_me, date_of_birth, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), username, 20+i%35, []string{"male", "female"}[i%2],
			"Seed", fmt.Sprintf("Explorer %03d", i+1), username+"@seed.space", string(hash),
			boolInt(i%9 == 0), fmt.Sprintf("Voyager%03d", i+1),
			"Synthetic development profile for testing populated social feeds and discovery.",
			fmt.Sprintf("%04d-%02d-%02d", 1975+i%25, 1+i%12, 1+i%27), created, created)
		if err != nil {
			return fmt.Errorf("insert bulk user %d: %w", i+1, err)
		}
		if err := tx.QueryRow(`SELECT id FROM users WHERE username = ?`, username).Scan(&userIDs[i]); err != nil {
			return fmt.Errorf("find bulk user %d: %w", i+1, err)
		}
	}

	groupIDs := make([]int, groupCount)
	groupCreators := make([]int, groupCount)
	for i := 0; i < groupCount; i++ {
		title := fmt.Sprintf("Seed Space Collective %02d", i+1)
		creatorID := userIDs[(i*3)%userCount]
		privacy := "public"
		if i%7 == 6 {
			privacy = "private"
		}
		created := now.Add(-time.Duration(groupCount-i) * 24 * time.Hour)
		_, err := tx.Exec(`
			INSERT INTO groups (creator_id, title, description, privacy, created_at, updated_at)
			SELECT ?, ?, ?, ?, ?, ?
			WHERE NOT EXISTS (SELECT 1 FROM groups WHERE title = ?)`,
			creatorID, title, "A seeded community for mission planning, astronomy, engineering, and space science.",
			privacy, created, created, title)
		if err != nil {
			return fmt.Errorf("insert bulk group %d: %w", i+1, err)
		}
		if err := tx.QueryRow(`SELECT id, creator_id FROM groups WHERE title = ?`, title).Scan(&groupIDs[i], &groupCreators[i]); err != nil {
			return fmt.Errorf("find bulk group %d: %w", i+1, err)
		}
	}

	// Give every group a useful membership set for group recommendations.
	for groupIndex, groupID := range groupIDs {
		for memberIndex := 0; memberIndex < 12; memberIndex++ {
			userID := userIDs[(groupIndex*3+memberIndex)%userCount]
			role := "member"
			if userID == groupCreators[groupIndex] {
				role = "creator"
			}
			if _, err := tx.Exec(`INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
				groupID, userID, role, now.Add(-time.Duration(30-memberIndex)*24*time.Hour)); err != nil {
				return fmt.Errorf("insert bulk group member: %w", err)
			}
		}
	}

	// Each generated user follows five nearby accounts, producing mutuals and
	// recommendation signals without creating a fully connected graph.
	for i, followerID := range userIDs {
		for distance := 1; distance <= 5; distance++ {
			followedID := userIDs[(i+distance)%userCount]
			if _, err := tx.Exec(`INSERT OR IGNORE INTO followers (follower_id, followed_id, created_at) VALUES (?, ?, ?)`,
				followerID, followedID, now.Add(-time.Duration(distance)*24*time.Hour)); err != nil {
				return fmt.Errorf("insert bulk follow: %w", err)
			}
		}
	}

	// Connect existing development personas to a sample of generated accounts
	// so Following/Friends feeds and recommendation widgets are populated.
	rows, err := tx.Query(`SELECT id FROM users WHERE username IN ('alice', 'cosmonaut', 'bader', 'bader1', 'bader2')`)
	if err != nil {
		return fmt.Errorf("find development personas: %w", err)
	}
	var viewerIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		viewerIDs = append(viewerIDs, id)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, viewerID := range viewerIDs {
		for i := 0; i < 16 && i < userCount; i++ {
			if _, err := tx.Exec(`INSERT OR IGNORE INTO followers (follower_id, followed_id, created_at) VALUES (?, ?, ?)`, viewerID, userIDs[i], now.Add(-48*time.Hour)); err != nil {
				return err
			}
			if i < 8 {
				if _, err := tx.Exec(`INSERT OR IGNORE INTO followers (follower_id, followed_id, created_at) VALUES (?, ?, ?)`, userIDs[i], viewerID, now.Add(-36*time.Hour)); err != nil {
					return err
				}
			}
		}
	}

	postIDs := make([]int, postCount)
	postAuthors := make([]int, postCount)
	for i := 0; i < postCount; i++ {
		title := fmt.Sprintf("Seed mission log %04d", i+1)
		authorID := userIDs[(i*7)%userCount]
		var groupID any
		if i%5 == 0 {
			groupIndex := (i / 5) % groupCount
			groupID = groupIDs[groupIndex]
			authorID = groupCreators[groupIndex]
		}
		created := now.Add(-time.Duration(i+1) * 37 * time.Minute)
		_, err := tx.Exec(`
			INSERT INTO posts (user_id, title, content, visibility, group_id, created_at, updated_at)
			SELECT ?, ?, ?, 'public', ?, ?, ?
			WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = ?)`,
			authorID, title,
			fmt.Sprintf("Mission update %d: telemetry is nominal. The team is reviewing orbital data, sharing observations, and preparing the next experiment window.", i+1),
			groupID, created, created, title)
		if err != nil {
			return fmt.Errorf("insert bulk post %d: %w", i+1, err)
		}
		if err := tx.QueryRow(`SELECT id, user_id FROM posts WHERE title = ?`, title).Scan(&postIDs[i], &postAuthors[i]); err != nil {
			return fmt.Errorf("find bulk post %d: %w", i+1, err)
		}
	}

	// Two deterministic comments per post create enough density for feed and
	// post-detail testing while remaining idempotent on repeated runs.
	for i, postID := range postIDs {
		for reply := 0; reply < 2; reply++ {
			authorID := userIDs[(i+reply+11)%userCount]
			content := fmt.Sprintf("Seed discussion %04d.%d — useful findings; comparing this with our latest mission telemetry.", i+1, reply+1)
			created := now.Add(-time.Duration(i+1)*37*time.Minute + time.Duration(reply+1)*4*time.Minute)
			if _, err := tx.Exec(`
				INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
				SELECT ?, ?, ?, ?, ?
				WHERE NOT EXISTS (SELECT 1 FROM comments WHERE post_id = ? AND user_id = ? AND content = ?)`,
				postID, authorID, content, created, created, postID, authorID, content); err != nil {
				return fmt.Errorf("insert bulk comment: %w", err)
			}
		}
	}

	for i := 0; i < postCount/2; i++ {
		senderID := userIDs[i%userCount]
		recipientID := userIDs[(i+1)%userCount]
		content := fmt.Sprintf("Seed direct message %04d about the next observation window.", i+1)
		created := now.Add(-time.Duration(i+1) * 19 * time.Minute)
		if _, err := tx.Exec(`
			INSERT INTO private_messages (sender_id, recipient_id, content, created_at)
			SELECT ?, ?, ?, ? WHERE NOT EXISTS (
				SELECT 1 FROM private_messages WHERE sender_id = ? AND recipient_id = ? AND content = ?
			)`, senderID, recipientID, content, created, senderID, recipientID, content); err != nil {
			return fmt.Errorf("insert bulk direct message: %w", err)
		}
	}

	for i := 0; i < postCount/2; i++ {
		groupIndex := i % groupCount
		userID := groupCreators[groupIndex]
		content := fmt.Sprintf("Seed group transmission %04d: systems check complete.", i+1)
		created := now.Add(-time.Duration(i+1) * 23 * time.Minute)
		if _, err := tx.Exec(`
			INSERT INTO group_messages (group_id, user_id, content, created_at)
			SELECT ?, ?, ?, ? WHERE NOT EXISTS (
				SELECT 1 FROM group_messages WHERE group_id = ? AND user_id = ? AND content = ?
			)`, groupIDs[groupIndex], userID, content, created, groupIDs[groupIndex], userID, content); err != nil {
			return fmt.Errorf("insert bulk group message: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit bulk seed: %w", err)
	}
	return nil
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
