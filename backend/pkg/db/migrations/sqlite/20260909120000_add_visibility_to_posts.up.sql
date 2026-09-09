PRAGMA foreign_keys = ON;

ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'custom'));

UPDATE posts SET visibility = 'custom' WHERE private = 1;

ALTER TABLE posts DROP COLUMN private;
