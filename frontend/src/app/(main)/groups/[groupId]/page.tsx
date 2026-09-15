import PageTransition from "@/components/transitions/PageTransition";
import GroupDetailsContent from "@/features/groups/components/GroupDetailsContent";

export default function GroupDetailsPage() {
  return (
    <PageTransition>
      <main className="group-details-page space-shell">
        <GroupDetailsContent />
      </main>
    </PageTransition>
  );
}
