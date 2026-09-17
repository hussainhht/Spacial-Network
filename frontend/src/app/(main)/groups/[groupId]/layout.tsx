import PageTransition from "@/components/transitions/PageTransition";
import GroupDetailsContent from "@/features/groups/components/GroupDetailsContent";

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageTransition>
      <main className="group-details-page space-shell">
        <GroupDetailsContent>{children}</GroupDetailsContent>
      </main>
    </PageTransition>
  );
}
