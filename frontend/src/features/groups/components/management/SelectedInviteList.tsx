"use client";

import UserAvatar from "@/components/UserAvatar";
import { getDisplayName } from "@/lib/utils";
import type { InviteCandidate } from "../../types/group";

interface SelectedInviteListProps {
  users: InviteCandidate[];
  onRemove: (userId: number) => void;
  disabled?: boolean;
  heading?: string;
}

export default function SelectedInviteList({
  users,
  onRemove,
  disabled = false,
  heading = "People to invite",
}: SelectedInviteListProps) {
  if (users.length === 0) return null;

  return (
    <div className="group-selected-invites">
      <p className="group-selected-invites-heading">
        {heading} · {users.length}
      </p>

      <ul className="group-selected-list">
        {users.map((user) => {
          const displayName = getDisplayName(
            user.firstName,
            user.lastName,
            user.username,
          );
          return (
            <li key={user.id} className="group-selected-chip">
              <UserAvatar
                src={user.avatar}
                firstName={user.firstName}
                lastName={user.lastName}
                username={user.username}
                size={20}
                alt=""
                className="group-selected-chip-avatar"
              />

              <span className="group-selected-chip-name">
                {displayName}
              </span>

              <button
                type="button"
                className="group-selected-chip-remove"
                onClick={() => onRemove(user.id)}
                disabled={disabled}
                aria-label={`Remove ${user.username} from invite list`}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
