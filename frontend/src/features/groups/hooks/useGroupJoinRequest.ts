"use client";

import { createJoinRequest } from "../api/groups";
import { useGroupAction } from "./useGroupAction";
import type { GroupPrivacy } from "../types/group";

export function useGroupJoinRequest(
  groupId: number,
  privacy: GroupPrivacy,
  state: { isMember: boolean; pending: boolean; invited: boolean },
) {
  const action = useGroupAction(`join:${groupId}`, groupId);
  const canRequest =
    privacy === "public" && !state.isMember && !state.pending && !state.invited;

  return {
    pending: state.pending,
    busy: action.busy,
    error: action.error,
    disabled: !canRequest || Boolean(action.busy),
    handleJoin: () => {
      if (canRequest)
        void action.run("Sending…", () => createJoinRequest(groupId));
    },
  };
}
