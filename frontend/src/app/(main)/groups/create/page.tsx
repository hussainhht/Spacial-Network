import Link from "next/link";
import CreateGroupForm from "@/features/groups/components/CreateGroupForm";

export default function CreateGroupPage() {
  return (
    <main className="group-create-page space-shell">
      <div className="group-create-container">
        <Link href="/groups" className="back-link">
          &larr; Back to groups
        </Link>

        <h1>Create Group</h1>

        <CreateGroupForm />
      </div>
    </main>
  );
}
