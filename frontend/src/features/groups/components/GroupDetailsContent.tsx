"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useGroup,
  useGroupMembers,
  useMembership,
  usePendingInvitations,
} from "../hooks/useGroupData";
import EditGroupForm from "./management/EditGroupForm";
import GroupAvatar from "./GroupAvatar";
import GroupDangerZone from "./management/GroupDangerZone";
import GroupEvents from "./events/GroupEvents";
import {
  GroupLoadError,
  MembersPanel,
  MembershipBadge,
  MembershipPanel,
} from "./GroupPanels";
import GroupTabs, { type ActiveGroupTab } from "./GroupTabs";

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
  const [activeTab, setActiveTab] = useState<ActiveGroupTab>("overview");
  const isCreator = membership.data?.role === "creator";

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
              <GroupAvatar group={group.data} size={64} />
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
          <GroupTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canEdit={isCreator}
          />
          {activeTab === "overview" && (
            <div
              id="group-tabpanel-overview"
              role="tabpanel"
              aria-labelledby="group-tab-overview"
              className="group-details-grid"
            >
              <div className="group-main-column">
                <MembershipPanel groupId={groupId} />
              </div>
              <MembersPanel
                groupId={groupId}
                creatorId={group.data.creatorId}
              />
            </div>
          )}
          {activeTab === "events" && (
            <div
              id="group-tabpanel-events"
              role="tabpanel"
              aria-labelledby="group-tab-events"
            >
              <GroupEvents
                groupId={groupId}
                isMember={Boolean(membership.data?.isMember)}
                members={members.data}
              />
            </div>
          )}
          {activeTab === "edit" && isCreator && (
            <div
              id="group-tabpanel-edit"
              role="tabpanel"
              aria-labelledby="group-tab-edit"
            >
              <EditGroupForm group={group.data} />
              <GroupDangerZone group={group.data} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
