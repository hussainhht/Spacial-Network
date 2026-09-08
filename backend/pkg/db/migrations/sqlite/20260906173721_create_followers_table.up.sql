PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS followers (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER  NOT NULL,
    followed_id INTEGER  NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (follower_id <> followed_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_followers_follower_followed
ON followers(follower_id, followed_id);

CREATE INDEX IF NOT EXISTS idx_followers_followed
ON followers(followed_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower
ON followers(follower_id);