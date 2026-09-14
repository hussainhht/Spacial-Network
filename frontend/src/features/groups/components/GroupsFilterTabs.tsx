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
    <div className="group-tabs" role="tablist" aria-label="Groups filter"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "mine" : event.key === "End" ? "all" : activeTab === "mine" ? "all" : "mine";
        onTabChange(next);
        document.getElementById(`groups-tab-${next}`)?.focus();
      }}
    >
      <button
        type="button"
        role="tab"
        id="groups-tab-mine"
        aria-selected={activeTab === "mine"}
        tabIndex={activeTab === "mine" ? 0 : -1}
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
        tabIndex={activeTab === "all" ? 0 : -1}
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
