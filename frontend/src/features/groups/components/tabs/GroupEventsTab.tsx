"use client";

import { useGroupPageContext } from "../GroupDetailsContent";
import GroupEvents from "../events/GroupEvents";

export default function GroupEventsTab() {
  const { groupId, isMember, members } = useGroupPageContext();

  return (
    <div
      id="group-tabpanel-events"
      role="tabpanel"
      aria-labelledby="group-tab-events"
      data-motion-panel
    >
      <GroupEvents
        groupId={groupId}
        isMember={isMember}
        members={members.data}
      />
    </div>
  );
}
