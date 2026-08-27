CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    session_token TEXT    NOT NULL UNIQUE,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATETIME NOT NULL,
    revoked_at    DATETIME,                              -- null = active

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
