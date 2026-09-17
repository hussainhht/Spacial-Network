"use client";

import { useGroupPageContext } from "../GroupDetailsContent";
import { JoinRequestsPanel, MembersPanel } from "../GroupPanels";

export default function GroupMembersTab() {
  const { groupId, group, isCreator } = useGroupPageContext();

  return (
    <div
      id="group-tabpanel-members"
      role="tabpanel"
      aria-labelledby="group-tab-members"
      className="group-members-tab-content"
      data-motion-panel
    >
      {isCreator && group.privacy === "public" && (
        <JoinRequestsPanel groupId={groupId} compact />
      )}
      <MembersPanel group={group} />
    </div>
  );
}
