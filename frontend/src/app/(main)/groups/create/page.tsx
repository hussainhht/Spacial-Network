import Link from "next/link";
import CreateGroupForm from "@/features/groups/components/management/CreateGroupForm";

export default function CreateGroupPage() {
  return (
    <main className="group-create-page space-shell">
      <div className="group-create-container">
        <Link href="/groups" className="back-link">
          &larr; Back to groups
        </Link>

        <header className="group-create-header">
          <h1>Create your group</h1>
        </header>

        <CreateGroupForm />
      </div>
    </main>
  );
}
