"use client";

import { GroupChatView } from "@/features/group-chat";
import { useGroupPageContext } from "../GroupDetailsContent";

export default function GroupChatTab() {
  const { group, members, isMember, navigateToTab } = useGroupPageContext();

  return (
    <div
      id="group-tabpanel-chat"
      role="tabpanel"
      aria-labelledby="group-tab-chat"
      data-motion-panel
    >
      <GroupChatView
        group={group}
        members={members.data ?? []}
        membersLoading={members.loading}
        isMember={isMember}
        onViewMembers={() => navigateToTab("members")}
      />
    </div>
  );
}
