-- add_group_photo_to_groups migration down
ALTER TABLE groups DROP COLUMN group_photo;
