"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import {
  useGroup,
  useGroupMembers,
  useMembership,
  usePendingInvitations,
} from "../hooks/useGroupData";
import EditGroupForm from "./management/EditGroupForm";
import GroupChatPanel from "./GroupChatPanel";
import GroupDangerZone from "./management/GroupDangerZone";
import GroupEvents from "./events/GroupEvents";
import GroupHeaderCard from "./GroupHeaderCard";
import GroupPosts from "./GroupPosts";
import {
  GroupLoadError,
  JoinRequestsPanel,
  MembersPanel,
  MembershipBadge,
  NonMemberActions,
} from "./GroupPanels";
import GroupTabs, { type ActiveGroupTab } from "./GroupTabs";
import GroupAboutCard from "./overview/GroupAboutCard";
import GroupActivityPreview from "./overview/GroupActivityPreview";
import GroupEventsPreview from "./overview/GroupEventsPreview";
import GroupMembersPreview from "./overview/GroupMembersPreview";

export default function GroupDetailsContent() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  if (!/^[1-9]\d*$/.test(groupId) || !Number.isSafeInteger(id))
    return (
      <div className="group-details-container">
        <Link href="/groups" className="back-link">
          <AppIcon name="arrowLeft" width={16} height={16} /> Back to groups
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
  const isMember = Boolean(membership.data?.isMember);
  const memberCount = members.data?.length ?? group.data?.memberCount ?? 0;

  const membershipStatus = (
    <>
      {!membership.loading &&
        !membership.error &&
        membership.data &&
        (membership.data.isMember ||
          (!invitations.loading && !invitations.error)) && (
          <MembershipBadge
            role={membership.data.isMember ? membership.data.role : undefined}
            pending={membership.data.hasPendingJoinRequest}
            invited={invitations.data?.some((i) => i.groupId === groupId)}
          />
        )}
      {membership.loading && (
        <span className="group-muted-inline">Checking membership…</span>
      )}
    </>
  );

  return (
    <div className="group-details-container">
      <Link href="/groups" className="back-link">
        <AppIcon name="arrowLeft" width={16} height={16} /> Back to groups
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
          <GroupHeaderCard
            group={group.data}
            memberCount={memberCount}
            isCreator={isCreator}
            onEditClick={() => setActiveTab("edit")}
            membershipStatus={membershipStatus}
          />
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
              className="group-overview-grid overviewGrid"
            >
              <main className="group-overview-column group-overview-main mainColumn">
                {membership.loading && (
                  <div className="group-panel group-loading" role="status">
                    Checking membership…
                  </div>
                )}
                {membership.error && (
                  <GroupLoadError
                    error={membership.error}
                    retry={membership.refresh}
                  />
                )}
                {!membership.loading &&
                  !membership.error &&
                  membership.data &&
                  (isMember ? (
                    <GroupPosts groupId={groupId} isMember={isMember} />
                  ) : (
                    <section
                      className="group-panel group-join-callout"
                      aria-labelledby="join-heading"
                    >
                      <div className="group-section-heading">
                        <h2 id="join-heading">Join this group</h2>
                      </div>
                      <NonMemberActions
                        groupId={groupId}
                        privacy={group.data.privacy}
                        pending={membership.data.hasPendingJoinRequest}
                      />
                    </section>
                  ))}
              </main>

              <aside
                className="group-overview-column group-overview-sidebar sideColumn"
                aria-label="Group information"
              >
                <GroupAboutCard group={group.data} />
                <GroupMembersPreview
                  groupId={groupId}
                  creatorId={group.data.creatorId}
                  onSeeAll={() => setActiveTab("members")}
                />
                <GroupEventsPreview
                  groupId={groupId}
                  isMember={isMember}
                  onSeeAll={() => setActiveTab("events")}
                />
                <GroupActivityPreview
                  group={group.data}
                  members={members.data}
                />
              </aside>
            </div>
          )}
          {activeTab === "posts" && (
            <div
              id="group-tabpanel-posts"
              role="tabpanel"
              aria-labelledby="group-tab-posts"
            >
              <GroupPosts groupId={groupId} isMember={isMember} />
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
                isMember={isMember}
                members={members.data}
              />
            </div>
          )}
          {activeTab === "members" && (
            <div
              id="group-tabpanel-members"
              role="tabpanel"
              aria-labelledby="group-tab-members"
            >
              <MembersPanel
                groupId={groupId}
                creatorId={group.data.creatorId}
              />
            </div>
          )}
          {activeTab === "chat" && (
            <div
              id="group-tabpanel-chat"
              role="tabpanel"
              aria-labelledby="group-tab-chat"
            >
              <GroupChatPanel groupId={groupId} isMember={isMember} />
            </div>
          )}
          {activeTab === "edit" && isCreator && (
            <div
              id="group-tabpanel-edit"
              role="tabpanel"
              aria-labelledby="group-tab-edit"
            >
              {group.data.privacy === "public" && (
                <JoinRequestsPanel groupId={groupId} />
              )}
              <EditGroupForm group={group.data} />
              <GroupDangerZone group={group.data} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
