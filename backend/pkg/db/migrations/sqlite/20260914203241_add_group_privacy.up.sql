PRAGMA foreign_keys = ON;

-- add_group_privacy migration up
ALTER TABLE groups
ADD COLUMN privacy TEXT NOT NULL DEFAULT 'public'
CHECK (privacy IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_groups_privacy_created_at
ON groups(privacy, created_at DESC, id DESC);
