PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    group_id    INTEGER  NOT NULL,
    created_by  INTEGER  NOT NULL,
    title       TEXT     NOT NULL,
    description TEXT     NOT NULL DEFAULT '',
    event_time  DATETIME NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
