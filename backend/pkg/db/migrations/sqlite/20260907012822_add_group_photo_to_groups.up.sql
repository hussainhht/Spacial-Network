PRAGMA foreign_keys = ON;

-- add_group_photo_to_groups migration up
ALTER TABLE groups ADD COLUMN group_photo TEXT;
