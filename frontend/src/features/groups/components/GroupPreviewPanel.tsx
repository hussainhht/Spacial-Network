"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import type { Group } from "../types/group";
import GroupAvatar from "./GroupAvatar";
import { MembershipBadge } from "./GroupPanels";
import styles from "./GroupGalaxy.module.css";

export default function GroupPreviewPanel({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 10, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.25,
          ease: "power2.out",
        },
      );
    });
    return () => media.revert();
  }, [group.id]);

  return (
    <aside
      ref={panelRef}
      id="group-preview"
      className={styles.preview}
      aria-labelledby="group-preview-title"
    >
      <div className={styles.previewTop}>
        <p className="group-eyebrow">In your orbit</p>
        <button
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
