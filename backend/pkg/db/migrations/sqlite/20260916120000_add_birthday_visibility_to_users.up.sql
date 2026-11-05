PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN birthday_visibility TEXT NOT NULL DEFAULT 'private' CHECK (birthday_visibility IN ('public', 'private'));
