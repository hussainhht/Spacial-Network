import { Suspense } from "react";
import PageTransition from "@/components/transitions/PageTransition";
import GroupsPageContent from "@/features/groups/components/GroupsPageContent";

export default function GroupsPage() {
  return (
    <PageTransition>
      <Suspense>
        <GroupsPageContent />
      </Suspense>
    </PageTransition>
  );
}
