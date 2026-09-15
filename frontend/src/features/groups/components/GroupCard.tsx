import Image from "next/image";
import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import { avatarUrl } from "../api/groups";
import type { Group } from "../types/group";
import { MembershipBadge } from "./GroupPanels";
import GroupJoinButton from "./GroupJoinButton";
import GroupPrivacyBadge from "./GroupPrivacyBadge";
import styles from "./GroupsDirectory.module.css";

export default function GroupCard({ group }: { group: Group }) {
  const photo = avatarUrl(group.groupPhoto);

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        {photo ? (
          <Image
            unoptimized
            src={photo}
            alt=""
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 920px) 50vw, 33vw"
            className={styles.coverImage}
          />
        ) : (
          <div className={styles.coverFallback} aria-hidden="true">
            <AppIcon name="groups" width={40} height={40} />
          </div>
        )}
        <span className={styles.coverBadge}>
          <GroupPrivacyBadge privacy={group.privacy} />
        </span>
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>
          <Link href={`/groups/${group.id}`} className={styles.titleLink}>
            {group.title}
          </Link>
        </h2>
        <p className={styles.cardDescription}>{group.description || "No description yet."}</p>
        <div className={styles.cardFooter}>
          <span className={styles.members}>
            <AppIcon name="groups" width={16} height={16} />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
          <div className={styles.cardActions}>
            {group.membershipRole === "creator" ? (
              <Link href={`/groups/${group.id}`} className="group-button">
                Manage
              </Link>
            ) : group.membershipRole ? (
              <MembershipBadge role={group.membershipRole} />
            ) : group.hasPendingInvitation ? (
              <MembershipBadge invited />
            ) : group.privacy === "public" ? (
              <GroupJoinButton
                groupId={group.id}
                privacy={group.privacy}
                pending={group.hasPendingJoinRequest}
              />
            ) : null}
          </div>
        </div>
      </div>
      <Link
        href={`/groups/${group.id}`}
        className={styles.cardStretch}
        aria-hidden="true"
        tabIndex={-1}
      />
    </article>
  );
}
