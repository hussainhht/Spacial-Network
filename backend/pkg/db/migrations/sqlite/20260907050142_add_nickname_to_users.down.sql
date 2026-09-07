-- add_nickname_to_users migration down
ALTER TABLE users DROP COLUMN nickname;
