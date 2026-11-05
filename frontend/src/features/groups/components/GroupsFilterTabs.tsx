"use client";

import SegmentedTabs from "@/components/SegmentedTabs";
import styles from "./GroupsDirectory.module.css";

export type GroupsTab = "mine" | "all" | "invitations";

interface GroupsFilterTabsProps {
  activeTab: GroupsTab;
  onTabChange: (tab: GroupsTab) => void;
  invitationCount?: number;
  className?: string;
}

export default function GroupsFilterTabs({
  activeTab,
  onTabChange,
  invitationCount = 0,
  className,
}: GroupsFilterTabsProps) {
  const options = [
    { value: "mine", label: "My Groups" },
    { value: "all", label: "All Groups" },
    {
      value: "invitations",
      label: (
        <>
          Invitations
          {invitationCount > 0 && (
            <span
              className={styles.tabBadge}
              aria-label={`${invitationCount} pending`}
            >
              {invitationCount > 99 ? "99+" : invitationCount}
            </span>
          )}
        </>
      ),
    },
  ] satisfies ReadonlyArray<{ value: GroupsTab; label: React.ReactNode }>;

  return (
    <SegmentedTabs
      value={activeTab}
      options={options}
      onChange={onTabChange}
      ariaLabel="Groups filter"
      idPrefix="groups"
      panelId={(tab) => `groups-tabpanel-${tab}`}
      className={className}
    />
  );
}
