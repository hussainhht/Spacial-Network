PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN about_me TEXT;
ALTER TABLE users ADD COLUMN date_of_birth DATE;