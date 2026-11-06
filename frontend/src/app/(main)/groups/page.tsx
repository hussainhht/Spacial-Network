import type { Metadata } from "next";
import { Suspense } from "react";
import PageTransition from "@/components/transitions/PageTransition";
import GroupsPageContent from "@/features/groups/components/GroupsPageContent";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <PageTransition>
      <Suspense>
        <GroupsPageContent />
      </Suspense>
    </PageTransition>
  );
}
