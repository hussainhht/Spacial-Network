import GroupSettingsPageContent from "@/features/groups/components/management/GroupSettingsPageContent";

export default function GroupSettingsPage() {
  return (
    <div
      id="group-tabpanel-settings"
      role="tabpanel"
      aria-labelledby="group-tab-settings"
      data-motion-panel
    >
      <GroupSettingsPageContent />
    </div>
  );
}
