"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useGroup,
  useGroupMembers,
  useMembership,
  usePendingInvitations,
} from "../hooks/useGroupData";
import {
  GroupLoadError,
  MembersPanel,
  MembershipBadge,
  MembershipPanel,
} from "./GroupPanels";

export default function GroupDetailsContent() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);
  if (!/^[1-9]\d*$/.test(groupId) || !Number.isSafeInteger(id))
    return (
      <div className="group-details-container">
        <Link href="/groups" className="back-link">
          ← Back to groups
        </Link>
        <p className="form-error" role="alert">
          Invalid group ID. Choose a group from the directory.
        </p>
      </div>
    );
  // A route change unmounts all transient action/search state. Query revisions
  // also prevent older in-flight responses from replacing the new group's data.
  return <GroupDetails key={id} groupId={id} />;
}
function GroupDetails({ groupId }: { groupId: number }) {
  // Independent subscriptions start these three requests concurrently.
  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const membership = useMembership(groupId);
  const invitations = usePendingInvitations();
  return (
    <div className="group-details-container">
      <Link href="/groups" className="back-link">
        ← Back to groups
      </Link>
      {group.loading && !group.data && (
        <div className="group-panel group-loading" role="status">
          Loading community…
        </div>
      )}
      {group.error && (
        <GroupLoadError error={group.error} retry={group.refresh} />
      )}
      {group.data && (
        <>
          <header className="group-detail-card">
            <div className="group-header-top">
              <span className="group-emblem" aria-hidden="true">
                {group.data.title.charAt(0).toUpperCase()}
              </span>
              <span className="group-eyebrow">Community</span>
            </div>
            <h1>{group.data.title}</h1>
            <p className="group-detail-creator">
              Created by @{group.data.creatorUsername}
            </p>
            <p className="group-detail-description">{group.data.description}</p>
            <div className="group-header-meta">
              <span>
                {members.data?.length ?? group.data.memberCount}{" "}
                {(members.data?.length ?? group.data.memberCount) === 1
                  ? "member"
                  : "members"}
              </span>
              {!membership.loading &&
                !membership.error &&
                membership.data &&
                (membership.data.isMember ||
                  (!invitations.loading && !invitations.error)) && (
                  <MembershipBadge
                    role={
                      membership.data.isMember
                        ? membership.data.role
                        : undefined
                    }
                    pending={membership.data.hasPendingJoinRequest}
                    invited={invitations.data?.some(
                      (i) => i.groupId === groupId,
                    )}
                  />
                )}
              {membership.loading && (
                <span className="group-muted">Checking membership…</span>
              )}
            </div>
          </header>
          <div className="group-details-grid">
            <div className="group-main-column">
              <MembershipPanel groupId={groupId} />
            </div>
            <MembersPanel groupId={groupId} creatorId={group.data.creatorId} />
          </div>
        </>
      )}
    </div>
  );
}
