"use client";

import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { useGroupMembers } from "../../hooks/useGroupData";
import { GroupLoadError } from "../GroupPanels";

const PREVIEW_COUNT = 5;

interface GroupMembersPreviewProps {
  groupId: number;
  creatorId: number;
  onSeeAll: () => void;
}

// Reads the same cached `useGroupMembers` resource as the Members tab, so
// switching tabs never triggers a second members request.
export default function GroupMembersPreview({
  groupId,
  creatorId,
  onSeeAll,
}: GroupMembersPreviewProps) {
  const state = useGroupMembers(groupId);
  const members = state.data?.slice(0, PREVIEW_COUNT);

  return (
    <section
      className="group-panel group-members-preview"
      aria-labelledby="members-preview-heading"
    >
      <div className="group-section-heading">
        <h2 id="members-preview-heading">
          Members{state.data && ` · ${state.data.length}`}
        </h2>
        <button type="button" className="group-see-all" onClick={onSeeAll}>
          See all →
        </button>
      </div>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {!state.data && state.loading && (
        <p className="group-muted">Loading members…</p>
      )}
      {members && members.length > 0 && (
        <ul className="group-members-preview-list">
          {members.map((member) => (
            <li key={member.userId} className="group-member-item">
              <UserAvatar
                src={member.avatar}
                username={member.username}
                size={32}
                alt=""
                className="group-member-avatar"
              />
              <Link
                className="group-member-name"
                href={`/profile/${encodeURIComponent(member.username)}`}
              >
                @{member.username}
              </Link>
              {member.userId === creatorId && (
                <span className="group-member-role">Creator</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!state.loading && state.data?.length === 0 && (
        <p className="group-muted">No members to display.</p>
      )}
    </section>
  );
}
