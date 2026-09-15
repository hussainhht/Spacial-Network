"use client";
import { useGroupJoinRequest } from "../hooks/useGroupJoinRequest";
import type { GroupPrivacy } from "../types/group";

export default function GroupJoinButton({
  groupId,
  privacy,
  isMember = false,
  pending = false,
  invited = false,
}: {
  groupId: number;
  privacy: GroupPrivacy;
  isMember?: boolean;
  pending?: boolean;
  invited?: boolean;
}) {
  const action = useGroupJoinRequest(groupId, privacy, {
    isMember,
    pending,
    invited,
  });

  return (
    <div className="group-join" aria-live="polite">
      <button
        type="button"
        className={`group-button${pending ? " secondary" : ""}`}
        onClick={action.handleJoin}
        disabled={action.disabled}
        aria-label={pending ? "Cancel pending join request" : undefined}
      >
        {action.busy ?? (pending ? "Cancel request" : "Request to Join")}
      </button>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </div>
  );
}
