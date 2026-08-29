PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS group_members (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER  NOT NULL,
    user_id    INTEGER  NOT NULL,
    role       TEXT     NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member')),
    joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_group_user ON group_members(group_id, user_id);
