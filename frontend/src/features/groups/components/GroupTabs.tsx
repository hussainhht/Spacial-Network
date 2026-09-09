"use client";

export type ActiveGroupTab = "overview" | "posts" | "events" | "edit";

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
        id="group-tab-posts"
        aria-selected={activeTab === "posts"}
        aria-controls="group-tabpanel-posts"
        data-active={activeTab === "posts"}
        className="group-tab"
        onClick={() => onTabChange("posts")}
      >
        Posts
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
      {canEdit && (
        <button
          type="button"
          role="tab"
          id="group-tab-edit"
          aria-selected={activeTab === "edit"}
          aria-controls="group-tabpanel-edit"
          data-active={activeTab === "edit"}
          className="group-tab"
          onClick={() => onTabChange("edit")}
        >
          Edit
        </button>
      )}
    </div>
  );
}
