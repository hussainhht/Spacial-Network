"use client";

export type GroupsTab = "mine" | "all";

interface GroupsFilterTabsProps {
  activeTab: GroupsTab;
  onTabChange: (tab: GroupsTab) => void;
}

export default function GroupsFilterTabs({
  activeTab,
  onTabChange,
}: GroupsFilterTabsProps) {
  return (
    <div className="group-tabs" role="tablist" aria-label="Groups filter">
      <button
        type="button"
        role="tab"
        id="groups-tab-mine"
        aria-selected={activeTab === "mine"}
        aria-controls="groups-tabpanel-mine"
        data-active={activeTab === "mine"}
        className="group-tab"
        onClick={() => onTabChange("mine")}
      >
        My Groups
      </button>
      <button
        type="button"
        role="tab"
        id="groups-tab-all"
        aria-selected={activeTab === "all"}
        aria-controls="groups-tabpanel-all"
        data-active={activeTab === "all"}
        className="group-tab"
        onClick={() => onTabChange("all")}
      >
        All Groups
      </button>
    </div>
  );
}
