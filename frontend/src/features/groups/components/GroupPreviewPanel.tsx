"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Group } from "../types/group";
import GroupAvatar from "./GroupAvatar";
import { MembershipBadge } from "./GroupPanels";
import styles from "./GroupPreviewPanel.module.css";

export default function GroupPreviewPanel({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, [group.id]);

  return (
    <aside
      id="group-preview"
      className={styles.preview}
      aria-labelledby="group-preview-title"
    >
      <div className={styles.previewTop}>
        <p className="group-eyebrow">Community preview</p>
        <button
          ref={closeButton}
          type="button"
          className={styles.close}
          aria-label="Close group preview"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <GroupAvatar group={group} size={64} />
      <MembershipBadge
        role={group.membershipRole}
        invited={group.hasPendingInvitation}
        pending={group.hasPendingJoinRequest}
      />
      <h2 id="group-preview-title">{group.title}</h2>
      <p className={styles.creator}>Created by @{group.creatorUsername}</p>
      <p className={styles.memberCount}>
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
      </p>
      <p className={styles.description}>{group.description}</p>
      <Link href={`/groups/${group.id}`} className="group-button">
        View Group <span aria-hidden="true">&nbsp; →</span>
      </Link>
    </aside>
  );
}
