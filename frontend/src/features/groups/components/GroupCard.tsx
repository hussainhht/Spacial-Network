import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import type { Group } from "../types/group";
import GroupAvatar from "./GroupAvatar";
import { MembershipBadge } from "./GroupPanels";
import GroupJoinButton from "./GroupJoinButton";
import GroupPrivacyBadge from "./GroupPrivacyBadge";
import styles from "./GroupsDirectory.module.css";

export default function GroupCard({ group, expanded, onPreview }: {
  group: Group;
  expanded: boolean;
  onPreview: () => void;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.identity}>
        <GroupAvatar group={group} size={56} />
        <div className={styles.badges}>
          <GroupPrivacyBadge privacy={group.privacy} />
          <MembershipBadge role={group.membershipRole} invited={group.hasPendingInvitation} pending={group.hasPendingJoinRequest} />
        </div>
      </div>
      <h2 className={styles.title}><Link href={`/groups/${group.id}`}>{group.title}</Link></h2>
      <p className={styles.cardDescription}>{group.description || "No description yet."}</p>
      {group.creatorUsername && <p className={styles.creator}>Created by <span>@{group.creatorUsername}</span></p>}
      <div className={styles.cardFooter}>
        <span className={styles.members}><AppIcon name="groups" width={16} height={16} />{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</span>
        <div className={styles.cardActions}>
          {group.privacy === "public" &&
            !group.membershipRole &&
            !group.hasPendingInvitation && (
            <GroupJoinButton
              groupId={group.id}
              privacy={group.privacy}
              pending={group.hasPendingJoinRequest}
            />
          )}
          {group.membershipRole === "creator" && (
            <Link href={`/groups/${group.id}`} className="group-button">
              Manage
            </Link>
          )}
          <button
            id={`group-preview-button-${group.id}`}
            type="button"
            className={`group-button secondary ${styles.preview}`}
            aria-label={`Open preview for ${group.title}`}
            aria-expanded={expanded}
            aria-controls={expanded ? "group-preview" : undefined}
            onClick={onPreview}
          >Preview <AppIcon name="arrow" width={16} height={16} /></button>
        </div>
      </div>
    </article>
  );
}
