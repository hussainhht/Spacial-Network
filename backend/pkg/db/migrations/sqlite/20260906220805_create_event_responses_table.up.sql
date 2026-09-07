PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS event_responses (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER  NOT NULL,
    user_id    INTEGER  NOT NULL,
    response   TEXT     NOT NULL CHECK (response IN ('going', 'not_going')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (event_id, user_id)
);
