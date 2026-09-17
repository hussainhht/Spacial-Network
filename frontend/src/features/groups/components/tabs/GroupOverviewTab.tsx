"use client";

import GroupPosts from "../GroupPosts";
import { GroupLoadError, NonMemberActions } from "../GroupPanels";
import GroupAboutCard from "../overview/GroupAboutCard";
import GroupActivityPreview from "../overview/GroupActivityPreview";
import GroupEventsPreview from "../overview/GroupEventsPreview";
import GroupMembersPreview from "../overview/GroupMembersPreview";
import { useGroupPageContext } from "../GroupDetailsContent";

export default function GroupOverviewTab() {
  const {
    groupId,
    group,
    members,
    membership,
    isMember,
    navigateToTab,
  } = useGroupPageContext();

  return (
    <div
      id="group-tabpanel-overview"
      role="tabpanel"
      aria-labelledby="group-tab-overview"
      className="group-overview-grid overviewGrid"
      data-motion-panel
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
                privacy={group.privacy}
                pending={membership.data.hasPendingJoinRequest}
              />
            </section>
          ))}
      </main>

      <aside
        className="group-overview-column group-overview-sidebar sideColumn"
        aria-label="Group information"
      >
        <GroupAboutCard group={group} />
        <GroupMembersPreview
          groupId={groupId}
          creatorId={group.creatorId}
          onSeeAll={() => navigateToTab("members")}
        />
        <GroupEventsPreview
          groupId={groupId}
          isMember={isMember}
          onSeeAll={() => navigateToTab("events")}
        />
        <GroupActivityPreview group={group} members={members.data} />
      </aside>
    </div>
  );
}
