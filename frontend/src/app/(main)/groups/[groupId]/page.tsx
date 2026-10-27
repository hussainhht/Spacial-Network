import { Suspense } from "react";
import { DEMO_MODE } from "@/demo/config";
import { DEMO_GROUPS } from "@/demo/seed";
import PageTransition from "@/components/transitions/PageTransition";
import GroupDetailsContent from "@/features/groups/components/GroupDetailsContent";

export default function GroupDetailsPage() {
  return (
    <PageTransition>
      <main className="group-details-page space-shell">
        <Suspense><GroupDetailsContent /></Suspense>
      </main>
    </PageTransition>
  );
}

export function generateStaticParams() { return DEMO_MODE ? [...DEMO_GROUPS.map(g=>({groupId:String(g.id)})),{groupId:"demo"}] : []; }
