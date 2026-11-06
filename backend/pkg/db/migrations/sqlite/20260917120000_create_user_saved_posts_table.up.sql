PRAGMA foreign_keys = ON;

-- Private per-user bookmarks. Rows are only ever read and written for the
-- authenticated owner (user_id), never exposed to other accounts.
CREATE TABLE IF NOT EXISTS user_saved_posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    post_id    INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- One bookmark per (user, post): what makes "save" idempotent via
-- INSERT OR IGNORE and "unsave" well defined.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_posts_user_post ON user_saved_posts(user_id, post_id);

-- Serves the saved-posts listing: one user's bookmarks, newest first. The
-- AUTOINCREMENT id grows monotonically with every new bookmark, so it is the
-- deterministic tie-breaker (and pagination cursor) when created_at repeats.
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_recent ON user_saved_posts(user_id, id DESC);

-- Serves the ON DELETE CASCADE from posts.
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_post_id ON user_saved_posts(post_id);
