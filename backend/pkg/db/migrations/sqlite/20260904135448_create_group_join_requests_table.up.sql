PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS group_join_requests (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER  NOT NULL,
    user_id    INTEGER  NOT NULL,
    status     TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_join_requests_group_user ON group_join_requests(group_id, user_id);
