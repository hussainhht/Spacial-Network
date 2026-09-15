"use client";

import SegmentedTabs from "@/components/SegmentedTabs";

export type ActiveGroupTab =
  | "overview"
  | "posts"
  | "events"
  | "members"
  | "chat"
  | "settings";

interface GroupTabsProps {
  activeTab: ActiveGroupTab;
  onTabChange: (tab: ActiveGroupTab) => void;
  canEdit?: boolean;
}

const GROUP_TABS = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
  { value: "events", label: "Events" },
  { value: "members", label: "Members" },
  { value: "chat", label: "Chat" },
] satisfies ReadonlyArray<{ value: ActiveGroupTab; label: string }>;

export default function GroupTabs({
  activeTab,
  onTabChange,
  canEdit,
}: GroupTabsProps) {
  const tabs = canEdit
    ? [...GROUP_TABS, { value: "settings" as const, label: "Settings" }]
    : GROUP_TABS;

  return (
    <SegmentedTabs
      value={activeTab}
      options={tabs}
      onChange={onTabChange}
      ariaLabel="Group sections"
      idPrefix="group"
      panelId={(tab) => `group-tabpanel-${tab}`}
      className="group-tabs"
    />
  );
}
