PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS private_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content      TEXT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at      DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_private_messages_pair 
ON private_messages(sender_id, recipient_id, created_at);

CREATE INDEX IF NOT EXISTS idx_private_messages_recipient 
ON private_messages(recipient_id, created_at);