import Link from "next/link";
import type { Group } from "../types/group";
import { MembershipBadge } from "./GroupPanels";

export default function GroupCard({ group }: { group: Group }) {
  return (
    <article className="group-card">
      <div className="group-card-top">
        <span className="group-emblem" aria-hidden="true">
          {group.title.charAt(0).toUpperCase()}
        </span>
        <MembershipBadge
          role={group.membershipRole}
          invited={group.hasPendingInvitation}
          pending={group.hasPendingJoinRequest}
        />
      </div>
      <h2>
        <Link href={`/groups/${group.id}`}>{group.title}</Link>
      </h2>
      <p className="group-card-creator">Created by @{group.creatorUsername}</p>
      <p className="group-card-description">{group.description}</p>
      <div className="group-card-footer">
        <span>
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </span>
        <Link href={`/groups/${group.id}`}>
          View Group <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
