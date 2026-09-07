"use client";

import { avatarUrl } from "../api/groups";
import type { InviteCandidate } from "../types/group";

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
          const photo = avatarUrl(user.avatar);
          const fullName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={user.id} className="group-selected-chip">
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  width={20}
                  height={20}
                  className="group-selected-chip-avatar"
                />
              ) : (
                <span
                  className="group-selected-chip-avatar fallback"
                  aria-hidden="true"
                >
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="group-selected-chip-name">
                {fullName || user.username}
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
