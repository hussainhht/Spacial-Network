PRAGMA foreign_keys = ON;

ALTER TABLE posts ADD COLUMN private BOOLEAN NOT NULL DEFAULT 0;

UPDATE posts SET private = 1 WHERE visibility != 'public';

ALTER TABLE posts DROP COLUMN visibility;
