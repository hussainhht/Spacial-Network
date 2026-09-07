PRAGMA foreign_keys = ON;

-- add_nickname_to_users migration up
ALTER TABLE users ADD COLUMN nickname TEXT;
