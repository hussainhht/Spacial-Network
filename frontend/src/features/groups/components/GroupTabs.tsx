"use client";

export type ActiveGroupTab = "overview" | "events";

interface GroupTabsProps {
  activeTab: ActiveGroupTab;
  onTabChange: (tab: ActiveGroupTab) => void;
}

export default function GroupTabs({ activeTab, onTabChange }: GroupTabsProps) {
  return (
    <div className="group-tabs" role="tablist" aria-label="Group sections">
      <button
        type="button"
        role="tab"
        id="group-tab-overview"
        aria-selected={activeTab === "overview"}
        aria-controls="group-tabpanel-overview"
        data-active={activeTab === "overview"}
        className="group-tab"
        onClick={() => onTabChange("overview")}
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        disabled
        className="group-tab group-tab-locked"
        title="Coming soon"
      >
        Posts{" "}
        <span className="group-tab-lock" aria-hidden="true">
          🔒
        </span>
      </button>
      <button
        type="button"
        role="tab"
        id="group-tab-events"
        aria-selected={activeTab === "events"}
        aria-controls="group-tabpanel-events"
        data-active={activeTab === "events"}
        className="group-tab"
        onClick={() => onTabChange("events")}
      >
        Events
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        disabled
        className="group-tab group-tab-locked"
        title="Coming soon"
      >
        Chat{" "}
        <span className="group-tab-lock" aria-hidden="true">
          🔒
        </span>
      </button>
    </div>
  );
}
