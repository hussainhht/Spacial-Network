PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    receiver_id INTEGER NOT NULL,
    actor_id INTEGER,

    type TEXT NOT NULL,

    entity_type TEXT,
    entity_id INTEGER,

    message TEXT NOT NULL,

    read_at DATETIME,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver_created ON notifications(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read ON notifications(receiver_id, read_at);
