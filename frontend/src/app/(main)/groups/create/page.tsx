import Link from "next/link";
import CreateGroupForm from "@/features/groups/components/CreateGroupForm";

export default function CreateGroupPage() {
  return (
    <main className="group-create-page space-shell">
      <div className="group-create-container">
        <Link href="/groups" className="back-link">
          &larr; Back to groups
        </Link>

        <header className="group-create-header">
          <p className="group-eyebrow">New community</p>
          <h1>Create your group</h1>
          <p className="group-muted">Bring people together around something you care about.</p>
        </header>

        <CreateGroupForm />
      </div>
    </main>
  );
}
