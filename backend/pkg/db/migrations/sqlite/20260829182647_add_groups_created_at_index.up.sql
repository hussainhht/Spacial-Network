PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at);
