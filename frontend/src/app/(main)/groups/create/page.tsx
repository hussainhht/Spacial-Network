import type { Metadata } from "next";
import Link from "next/link";
import PageTransition from "@/components/transitions/PageTransition";
import CreateGroupForm from "@/features/groups/components/management/CreateGroupForm";

export const metadata: Metadata = { title: "Create Group" };

export default function CreateGroupPage() {
  return (
    <PageTransition>
      <main className="group-create-page space-shell">
        <div className="group-create-container" data-motion-section>
          <Link href="/groups" className="back-link">
            &larr; Back to groups
          </Link>

          <header className="group-create-header">
            <h1>Create your group</h1>
          </header>

          <CreateGroupForm />
        </div>
      </main>
    </PageTransition>
  );
}
