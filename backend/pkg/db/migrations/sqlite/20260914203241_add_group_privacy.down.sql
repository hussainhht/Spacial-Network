-- add_group_privacy migration down
DROP INDEX IF EXISTS idx_groups_privacy_created_at;
ALTER TABLE groups DROP COLUMN privacy;
