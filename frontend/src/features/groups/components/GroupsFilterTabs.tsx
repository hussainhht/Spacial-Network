"use client";

import SegmentedTabs from "@/components/SegmentedTabs";

export type GroupsTab = "mine" | "all";

const GROUP_FILTERS = [
  { value: "mine", label: "My Groups" },
  { value: "all", label: "All Groups" },
] satisfies ReadonlyArray<{ value: GroupsTab; label: string }>;

interface GroupsFilterTabsProps {
  activeTab: GroupsTab;
  onTabChange: (tab: GroupsTab) => void;
  className?: string;
}

export default function GroupsFilterTabs({
  activeTab,
  onTabChange,
  className,
}: GroupsFilterTabsProps) {
  return (
    <SegmentedTabs
      value={activeTab}
      options={GROUP_FILTERS}
      onChange={onTabChange}
      ariaLabel="Groups filter"
      idPrefix="groups"
      panelId={(tab) => `groups-tabpanel-${tab}`}
      className={className}
    />
  );
}
