import Link from "next/link";
import type { Group } from "../types/group";

interface GroupCardProps {
  group: Group;
}

export default function GroupCard({ group }: GroupCardProps) {
  return (
    <article>
      <h2>
        <Link href={`/groups/${group.id}`}>
          {group.title}
        </Link>
      </h2>

      <p>{group.description}</p>
    </article>
  );
}