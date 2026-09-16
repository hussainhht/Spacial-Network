"use client";

import { useEffect, useRef } from "react";
import AppIcon from "@/components/layout/AppIcon";
import GroupAvatar from "@/features/groups/components/GroupAvatar";
import type { Group, GroupMember } from "@/features/groups/types/group";
import GroupChatMembersPreview from "./GroupChatMembersPreview";
import styles from "../group-chat.module.css";

interface GroupChatInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  members: GroupMember[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isUserOnline: (userId: number) => boolean;
  onlineCount: number;
  totalMembersCount: number;
  loading?: boolean;
  onViewMembers: () => void;
}

export default function GroupChatInfoSheet({
  isOpen,
  onClose,
  group,
  members,
  searchQuery,
  onSearchChange,
  isUserOnline,
  onlineCount,
  totalMembersCount,
  loading = false,
  onViewMembers,
}: GroupChatInfoSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Escape closes sheet
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus close button on open
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleViewAll = () => {
    onClose();
    onViewMembers();
  };

  return (
    <>
      <div
        className={styles.sheetBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-chat-sheet-title"
        className={styles.sheetContent}
      >
        <div className={styles.sheetHeader}>
          <h3 id="group-chat-sheet-title" className={styles.sheetHeaderTitle}>
            Group Info & Members
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.sheetCloseButton}
            onClick={onClose}
            aria-label="Close group information"
          >
            <AppIcon name="x" width={20} height={20} />
          </button>
        </div>

        <div className={styles.infoRailSummary}>
          <div className={styles.infoRailEmblem}>
            <GroupAvatar group={group} size={52} />
          </div>
          <h4 className={styles.infoRailTitle}>{group.title}</h4>
          <span className={styles.infoRailPrivacyBadge}>
            {group.privacy} group
          </span>
          {group.description && (
            <p className={styles.infoRailDesc}>{group.description}</p>
          )}
        </div>

        <div className={styles.infoRailMembersHeader}>
          <h4 className={styles.infoRailMembersHeading}>
            <span>Members · {totalMembersCount}</span>
            {onlineCount > 0 && (
              <span className={styles.infoRailOnlineBadge}>
                {onlineCount} online
              </span>
            )}
          </h4>

          <button
            type="button"
            onClick={handleViewAll}
            className={styles.infoRailViewAllBtn}
          >
            View all
          </button>
        </div>

        <GroupChatMembersPreview
          members={members}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          isUserOnline={isUserOnline}
          creatorId={group.creatorId}
          loading={loading}
        />
      </div>
    </>
  );
}

