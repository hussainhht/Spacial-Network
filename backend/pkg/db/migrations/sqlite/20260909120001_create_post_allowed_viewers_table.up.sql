PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS post_allowed_viewers (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER  NOT NULL,
    user_id    INTEGER  NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_allowed_viewers_post_user
ON post_allowed_viewers(post_id, user_id);

CREATE INDEX IF NOT EXISTS idx_post_allowed_viewers_user
ON post_allowed_viewers(user_id);
