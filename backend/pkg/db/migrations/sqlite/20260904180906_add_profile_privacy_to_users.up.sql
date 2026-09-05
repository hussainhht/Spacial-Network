PRAGMA foreign_keys = ON;

ALTER TABLE users
ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1));
