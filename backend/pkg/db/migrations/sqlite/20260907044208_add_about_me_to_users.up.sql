PRAGMA foreign_keys = ON;

-- add_about_me_to_users migration up
ALTER TABLE users ADD COLUMN about_me TEXT;
