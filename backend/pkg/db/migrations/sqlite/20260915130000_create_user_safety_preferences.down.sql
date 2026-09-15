PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS idx_user_mutes_muted;
DROP INDEX IF EXISTS idx_user_blocks_blocked;
DROP TABLE IF EXISTS user_mutes;
DROP TABLE IF EXISTS user_blocks;
