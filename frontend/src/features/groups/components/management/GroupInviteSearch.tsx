"use client";

import { useGroupInvitation } from "../../hooks/useGroupInvitation";
import InviteUserSearch from "./InviteUserSearch";

interface GroupInviteSearchProps {
  groupId: number;
}

// Sends invitations immediately - used from the Group Details members panel,
// where the group already exists and has members. The Create Group flow
// reuses the same underlying InviteUserSearch but selects locally instead,
// since invitations can only be sent after the group is created.
export default function GroupInviteSearch({ groupId }: GroupInviteSearchProps) {
  const { invitingId, invitedIds, rowErrors, handleInvite } =
    useGroupInvitation(groupId);

  return (
    <InviteUserSearch
      groupId={groupId}
      autoFocus
      renderAction={(user) => {
        const invited = invitedIds.includes(user.id);
        const rowError = rowErrors[user.id];

        return (
          <>
            <button
              type="button"
              className={`group-invite-action-btn${invited ? " is-selected" : ""}`}
              onClick={() => handleInvite(user.id)}
              disabled={invited || invitingId === user.id}
            >
              {invited
                ? "✓ Invited"
                : invitingId === user.id
                  ? "Inviting..."
                  : "+ Invite"}
            </button>
            {rowError && <p className="form-error">{rowError}</p>}
          </>
        );
      }}
    />
  );
}
