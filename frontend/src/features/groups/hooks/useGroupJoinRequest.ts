"use client";

import { createJoinRequest } from "../api/groups";
import { useGroupAction } from "./useGroupAction";
import { useMembership, usePendingInvitations } from "./useGroupData";

export function useGroupJoinRequest(groupId: number) {
  const membership = useMembership(groupId);
  const invitations = usePendingInvitations();
  const action = useGroupAction(`join:${groupId}`, groupId);
  const pending = membership.data?.hasPendingJoinRequest ?? false;
  const canRequest = !membership.loading && !invitations.loading && !membership.error && !invitations.error && membership.data && !membership.data.isMember && !pending && !invitations.data?.some(i => i.groupId === groupId);
  return {
    pending, busy: action.busy, error: action.error,
    disabled: !canRequest || Boolean(action.busy),
    handleRequestToJoin: () => { if (canRequest) void action.run("Sending…", () => createJoinRequest(groupId)); },
  };
}
