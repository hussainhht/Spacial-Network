PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS follow_requests (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER  NOT NULL,
    target_id    INTEGER  NOT NULL,
    status       TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (requester_id <> target_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_requests_requester_target
ON follow_requests(requester_id, target_id);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target_status
ON follow_requests(target_id, status);