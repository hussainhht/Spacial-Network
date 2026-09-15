import PageTransition from "@/components/transitions/PageTransition";
import GroupSettingsPageContent from "@/features/groups/components/management/GroupSettingsPageContent";

export default function GroupSettingsPage() {
  return (
    <PageTransition>
      <main className="space-shell">
        <GroupSettingsPageContent />
      </main>
    </PageTransition>
  );
}
