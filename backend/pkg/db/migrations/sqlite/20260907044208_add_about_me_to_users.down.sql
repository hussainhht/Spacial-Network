-- add_about_me_to_users migration down
ALTER TABLE users DROP COLUMN about_me;
