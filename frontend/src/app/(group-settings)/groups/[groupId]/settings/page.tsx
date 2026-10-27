import { Suspense } from "react";
import { DEMO_MODE } from "@/demo/config";
import { DEMO_GROUPS } from "@/demo/seed";
import PageTransition from "@/components/transitions/PageTransition";
import GroupSettingsPageContent from "@/features/groups/components/management/GroupSettingsPageContent";

export default function GroupSettingsPage() {
  return (
    <PageTransition>
      <main className="space-shell">
        <Suspense><GroupSettingsPageContent /></Suspense>
      </main>
    </PageTransition>
  );
}

export function generateStaticParams() {
   return DEMO_MODE ? [...DEMO_GROUPS.map(g=>({groupId:String(g.id)})),{groupId:"demo"}] : []; }
