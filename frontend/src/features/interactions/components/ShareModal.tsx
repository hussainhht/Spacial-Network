"use client";

import { useEffect, useState } from "react";
import { getEligibleContacts } from "@/features/chat/api/chat";
import type { EligibleContact } from "@/features/chat/types/chat";
import { getMyGroups } from "@/features/groups/api/groups";
import type { Group } from "@/features/groups/types/group";
import { getBackendBaseUrl } from "@/lib/api";
import { getDisplayName, getInitials } from "@/lib/utils";
import { sharePost } from "../api/share";
// Reuses the chat feature's modal styling so the share picker matches the
// app's existing contact-picker look (see NewChatModal) without a new CSS
// file.
import styles from "@/features/chat/components/Chat.module.css";

interface ShareModalProps {
  postId: number;
  onClose: () => void;
}

export default function ShareModal({ postId, onClose }: ShareModalProps) {
  const [target, setTarget] = useState<"user" | "group">("user");
  const [contacts, setContacts] = useState<EligibleContact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentId, setSentId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const trimmed = searchQuery.trim();
    const delay = trimmed ? 250 : 0;

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const request =
        target === "user"
          ? getEligibleContacts(trimmed, 20, 0).then((data) => {
              if (isMounted) setContacts(data);
            })
          : getMyGroups(20, 0, trimmed).then((data) => {
              if (isMounted) setGroups(data);
            });

      request
        .catch((err) => {
          if (isMounted) {
            setError(
              err instanceof Error
                ? err.message
                : `Failed to load ${target === "user" ? "contacts" : "groups"}`
            );
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, target]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getFullPhotoUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendBaseUrl()}${cleanPath}`;
  };

  async function handleSend(targetId: number) {
    setSendingId(targetId);
    setError(null);
    try {
      await sharePost(postId, { target, target_id: targetId });
      setSentId(targetId);
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share post");
    } finally {
      setSendingId(null);
    }
  }

  function handleTabChange(nextTarget: "user" | "group") {
    if (nextTarget === target) return;
    setTarget(nextTarget);
    setError(null);
    setSentId(null);
  }

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="share-modal-title"
    >
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="share-modal-title" className={styles.modalTitle}>
            Share to a chat
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalCloseBtn}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className={styles.filterChips} style={{ padding: "0 16px 12px" }}>
          <button
            type="button"
            onClick={() => handleTabChange("user")}
            className={`${styles.filterChip} ${target === "user" ? styles.filterChipActive : ""}`}
          >
            People
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("group")}
            className={`${styles.filterChip} ${target === "group" ? styles.filterChipActive : ""}`}
          >
            Groups
          </button>
        </div>

        <div className={styles.modalSearchWrapper}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              autoFocus
              placeholder={
                target === "user" ? "Search people you follow or followers..." : "Search your groups..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={styles.searchClearBtn}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <div className={styles.modalContactList}>
          {loading && contacts.length === 0 && groups.length === 0 && (
            <div className={styles.loadingNotice}>
              {target === "user"
                ? searchQuery.trim()
                  ? "Searching contacts..."
                  : "Finding eligible contacts..."
                : searchQuery.trim()
                ? "Searching groups..."
                : "Loading your groups..."}
            </div>
          )}

          {error && !loading && (
            <div className={styles.emptyNotice} style={{ color: "var(--space-error-text, #fca5a5)" }}>
              <p>{error}</p>
            </div>
          )}

          {target === "user" && !loading && !error && contacts.length === 0 && (
            <div className={styles.emptyNotice}>
              {searchQuery.trim() ? (
                <>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--space-text-heading, #f8fafc)" }}>
                    No contacts found
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    No contacts matching &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--space-text-heading, #f8fafc)" }}>
                    No eligible contacts
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: 1.5 }}>
                    You can only share with users you follow or who follow you.
                  </p>
                </>
              )}
            </div>
          )}

          {target === "group" && !loading && !error && groups.length === 0 && (
            <div className={styles.emptyNotice}>
              {searchQuery.trim() ? (
                <>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--space-text-heading, #f8fafc)" }}>
                    No groups found
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    No groups matching &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--space-text-heading, #f8fafc)" }}>
                    No groups yet
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: 1.5 }}>
                    You can only share with groups you belong to.
                  </p>
                </>
              )}
            </div>
          )}

          {target === "user" &&
            !loading &&
            !error &&
            contacts.map((contact) => {
              const displayName = getDisplayName(contact.first_name, contact.last_name, contact.username);
              const initials = getInitials(contact.first_name, contact.last_name, contact.username);
              const avatarUrl = contact.profile_photo ? getFullPhotoUrl(contact.profile_photo) : "";
              const isSending = sendingId === contact.id;
              const isSent = sentId === contact.id;

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSend(contact.id)}
                  disabled={isSending || isSent}
                  className={styles.modalContactItem}
                >
                  <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className={styles.avatarImg} />
                    ) : (
                      <div className={styles.avatarFallback}>{initials}</div>
                    )}
                  </div>

                  <div className={styles.modalContactInfo}>
                    <span className={styles.modalContactName}>{displayName}</span>
                    <span className={styles.modalContactUsername}>@{contact.username}</span>
                  </div>

                  <span className={styles.mutualBadge}>
                    {isSent ? "Sent" : isSending ? "Sending…" : "Send"}
                  </span>
                </button>
              );
            })}

          {target === "group" &&
            !loading &&
            !error &&
            groups.map((group) => {
              const avatarUrl = group.groupPhoto ? getFullPhotoUrl(group.groupPhoto) : "";
              const initials = getInitials("", "", group.title);
              const isSending = sendingId === group.id;
              const isSent = sentId === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSend(group.id)}
                  disabled={isSending || isSent}
                  className={styles.modalContactItem}
                >
                  <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={group.title} className={styles.avatarImg} />
                    ) : (
                      <div className={styles.avatarFallback}>{initials}</div>
                    )}
                  </div>

                  <div className={styles.modalContactInfo}>
                    <span className={styles.modalContactName}>{group.title}</span>
                    <span className={styles.modalContactUsername}>
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <span className={styles.mutualBadge}>
                    {isSent ? "Sent" : isSending ? "Sending…" : "Send"}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
