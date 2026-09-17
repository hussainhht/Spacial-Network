"use client";

import SegmentedTabs from "@/components/SegmentedTabs";

export type ActiveGroupTab =
  | "overview"
  | "events"
  | "members"
  | "chat"
  | "settings";

const GROUP_TABS = [
  { value: "overview", label: "Overview", segment: "" },
  { value: "events", label: "Events", segment: "events" },
  { value: "members", label: "Members", segment: "members" },
  { value: "chat", label: "Chat", segment: "chat" },
  { value: "settings", label: "Settings", segment: "settings" },
] satisfies ReadonlyArray<{
  value: ActiveGroupTab;
  label: string;
  segment: string;
}>;

export function getGroupTabHref(groupId: number, tab: ActiveGroupTab) {
  const segment = GROUP_TABS.find((item) => item.value === tab)?.segment;
  return `/groups/${groupId}${segment ? `/${segment}` : ""}`;
}

export function getActiveGroupTab(pathname: string, groupId: number) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return (
    GROUP_TABS.find(
      ({ value }) => normalizedPath === getGroupTabHref(groupId, value),
    )?.value ?? "overview"
  );
}

interface GroupTabsProps {
  activeTab: ActiveGroupTab;
  onTabChange: (tab: ActiveGroupTab) => void;
  canEdit?: boolean;
}

export default function GroupTabs({
  activeTab,
  onTabChange,
  canEdit,
}: GroupTabsProps) {
  const tabs = canEdit
    ? GROUP_TABS
    : GROUP_TABS.filter(({ value }) => value !== "settings");

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
