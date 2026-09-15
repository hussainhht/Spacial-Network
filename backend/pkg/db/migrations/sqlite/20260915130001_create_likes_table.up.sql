PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS likes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One like per (post, user): the uniqueness that makes an "unlike" well
-- defined, and what lets CreateLike be idempotent via INSERT OR IGNORE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
