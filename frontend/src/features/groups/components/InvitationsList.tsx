"use client";

import Link from "next/link";
import { groupHref } from "@/demo/config";
import AppIcon from "@/components/layout/AppIcon";
import { usePendingInvitations } from "../hooks/useGroupData";
import { GroupLoadError } from "./GroupPanels";
import GroupPrivacyBadge from "./GroupPrivacyBadge";
import { InvitationActions } from "./GroupResponseActions";
import styles from "./InvitationsList.module.css";

export default function InvitationsList() {
  const state = usePendingInvitations();
  const invitations = state.data ?? [];

  return (
    <div aria-busy={state.loading}>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {state.loading && !state.data && (
        <div className={styles.list} aria-hidden="true">
          {[0, 1].map((item) => (
            <div className={`${styles.card} ${styles.skeleton}`} key={item} />
          ))}
        </div>
      )}
      {!state.loading && !state.error && invitations.length === 0 && (
        <div className={styles.empty}>
          <AppIcon name="groups" width={24} height={24} />
          <h2>No pending invitations</h2>
          <p>New group invitations will appear here.</p>
        </div>
      )}
      {invitations.length > 0 && (
        <ul className={styles.list} aria-label="Pending invitations">
          {invitations.map((invitation) => (
            <li key={invitation.id} className={styles.card}>
              <span className={styles.avatar} aria-hidden="true">
                {invitation.groupTitle.trim().charAt(0).toUpperCase() || "G"}
              </span>
              <div className={styles.info}>
                {invitation.groupPrivacy === "public" ? (
                  <Link
                    className={styles.title}
                    href={groupHref(invitation.groupId)}
                  >
                    {invitation.groupTitle}
                  </Link>
                ) : (
                  <span className={styles.title}>{invitation.groupTitle}</span>
                )}
                <span className={styles.meta}>
                  <span>Invited by @{invitation.inviterUsername}</span>
                  <GroupPrivacyBadge privacy={invitation.groupPrivacy} />
                </span>
              </div>
              <div className={styles.actions}>
                <InvitationActions
                  groupId={invitation.groupId}
                  entityId={invitation.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
