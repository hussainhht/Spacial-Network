-- The migration runner wraps this in a transaction. Repeated historical
-- attempts make CREATE UNIQUE INDEX fail, rolling back all index changes.
-- History must never be deleted to permit a downgrade.
DROP INDEX idx_group_invitations_group_invited_user;
DROP INDEX idx_group_join_requests_group_user;
CREATE UNIQUE INDEX idx_group_invitations_group_invited_user
    ON group_invitations(group_id, invited_user_id);
CREATE UNIQUE INDEX idx_group_join_requests_group_user
    ON group_join_requests(group_id, user_id);
