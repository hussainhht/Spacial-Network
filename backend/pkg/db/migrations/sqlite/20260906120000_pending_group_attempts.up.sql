-- Preserve completed attempts; only one pending attempt per group/user.
DROP INDEX idx_group_invitations_group_invited_user;
DROP INDEX idx_group_join_requests_group_user;
CREATE UNIQUE INDEX idx_group_invitations_group_invited_user
    ON group_invitations(group_id, invited_user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_group_join_requests_group_user
    ON group_join_requests(group_id, user_id) WHERE status = 'pending';
