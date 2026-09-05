PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS group_invitations (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    group_id        INTEGER  NOT NULL,
    invited_by      INTEGER  NOT NULL,
    invited_user_id INTEGER  NOT NULL,
    status          TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invitations_group_invited_user ON group_invitations(group_id, invited_user_id);
