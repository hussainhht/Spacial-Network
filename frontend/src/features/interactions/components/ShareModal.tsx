"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppIcon from "@/components/layout/AppIcon";
import { getEligibleContacts } from "@/features/chat/api/chat";
import type { EligibleContact } from "@/features/chat/types/chat";
import { getMyGroups } from "@/features/groups/api/groups";
import type { Group } from "@/features/groups/types/group";
import { getBackendBaseUrl } from "@/lib/api";
import { getDisplayName, getInitials } from "@/lib/utils";
import { sharePost } from "../api/share";
import styles from "./ShareModal.module.css";

interface ShareModalProps {
  postId: number;
  onClose: () => void;
}

type ShareTarget = "user" | "group";

function recipientKey(target: ShareTarget, id: number) {
  return `${target}:${id}`;
}

export default function ShareModal({ postId, onClose }: ShareModalProps) {
  const [target, setTarget] = useState<ShareTarget>("user");
  const [contacts, setContacts] = useState<EligibleContact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [sentKeys, setSentKeys] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;
    const trimmed = searchQuery.trim();
    const delay = trimmed ? 250 : 0;

    const timer = setTimeout(() => {
      setLoadError(null);
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
            setLoadError(
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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  const getFullPhotoUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendBaseUrl()}${cleanPath}`;
  };

  async function handleSend(targetId: number) {
    const currentTarget = target;
    const key = recipientKey(currentTarget, targetId);
    setSendingKey(key);
    setActionError(null);
    try {
      await sharePost(postId, { target: currentTarget, target_id: targetId });
      setSentKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to share post");
    } finally {
      setSendingKey(null);
    }
  }

  function handleTabChange(nextTarget: ShareTarget) {
    if (nextTarget === target) return;
    setLoading(true);
    setTarget(nextTarget);
    setLoadError(null);
    setActionError(null);
  }

  const sharedCount = sentKeys.size;

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="share-modal-title"
        aria-describedby="share-modal-description"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="share-modal-title" className={styles.modalTitle}>Share post</h2>
            <p id="share-modal-description" className={styles.modalDescription}>
              Send this post to people or groups.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalCloseBtn}
            aria-label="Close share dialog"
          >
            <AppIcon name="x" width={19} height={19} />
          </button>
        </div>

        <div className={styles.filterChips} role="tablist" aria-label="Share destination">
          <button
            type="button"
            onClick={() => handleTabChange("user")}
            className={`${styles.filterChip} ${target === "user" ? styles.filterChipActive : ""}`}
            role="tab"
            id="share-people-tab"
            aria-selected={target === "user"}
            aria-controls="share-recipient-list"
          >
            People
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("group")}
            className={`${styles.filterChip} ${target === "group" ? styles.filterChipActive : ""}`}
            role="tab"
            id="share-groups-tab"
            aria-selected={target === "group"}
            aria-controls="share-recipient-list"
          >
            Groups
          </button>
        </div>

        <div className={styles.modalSearchWrapper}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              <AppIcon name="search" width={17} height={17} />
            </span>
            <input
              type="text"
              autoFocus
              placeholder={
                target === "user" ? "Search people you follow or followers..." : "Search your groups..."
              }
              value={searchQuery}
              onChange={(event) => {
                setLoading(true);
                setSearchQuery(event.target.value);
              }}
              className={styles.searchInput}
              aria-label={target === "user" ? "Search people" : "Search groups"}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setSearchQuery("");
                }}
                className={styles.searchClearBtn}
                aria-label="Clear search"
              >
                <AppIcon name="x" width={15} height={15} />
              </button>
            )}
          </div>
        </div>

        <div
          id="share-recipient-list"
          className={styles.modalContactList}
          role="tabpanel"
          aria-labelledby={target === "user" ? "share-people-tab" : "share-groups-tab"}
        >
          {actionError && (
            <div className={styles.actionError} role="alert">
              {actionError}
            </div>
          )}

          {loading && (
            <div className={styles.loadingNotice}>
              <span className={styles.spinner} aria-hidden="true" />
              {target === "user"
                ? searchQuery.trim()
                  ? "Searching contacts..."
                  : "Finding eligible contacts..."
                : searchQuery.trim()
                ? "Searching groups..."
                : "Loading your groups..."}
            </div>
          )}

          {loadError && !loading && (
            <div className={`${styles.emptyNotice} ${styles.loadError}`} role="alert">
              <p>{loadError}</p>
            </div>
          )}

          {target === "user" && !loading && !loadError && contacts.length === 0 && (
            <div className={styles.emptyNotice}>
              {searchQuery.trim() ? (
                <>
                  <p className={styles.emptyTitle}>No contacts found</p>
                  <p className={styles.emptyCopy}>
                    No contacts matching &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.emptyTitle}>No eligible contacts</p>
                  <p className={styles.emptyCopy}>
                    You can only share with users you follow or who follow you.
                  </p>
                </>
              )}
            </div>
          )}

          {target === "group" && !loading && !loadError && groups.length === 0 && (
            <div className={styles.emptyNotice}>
              {searchQuery.trim() ? (
                <>
                  <p className={styles.emptyTitle}>No groups found</p>
                  <p className={styles.emptyCopy}>
                    No groups matching &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.emptyTitle}>No groups yet</p>
                  <p className={styles.emptyCopy}>
                    You can only share with groups you belong to.
                  </p>
                </>
              )}
            </div>
          )}

          {target === "user" &&
            !loading &&
            !loadError &&
            contacts.map((contact) => {
              const displayName = getDisplayName(contact.first_name, contact.last_name, contact.username);
              const initials = getInitials(contact.first_name, contact.last_name, contact.username);
              const avatarUrl = contact.profile_photo ? getFullPhotoUrl(contact.profile_photo) : "";
              const key = recipientKey("user", contact.id);
              const isSending = sendingKey === key;
              const isSent = sentKeys.has(key);

              return (
                <div
                  key={contact.id}
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

                  <button
                    type="button"
                    onClick={() => handleSend(contact.id)}
                    disabled={Boolean(sendingKey) || isSent}
                    className={`${styles.sendButton} ${isSent ? styles.sendButtonSent : ""}`}
                    aria-label={isSent ? `Sent to ${displayName}` : `Send to ${displayName}`}
                  >
                    {isSent && <span aria-hidden="true">✓</span>}
                    {isSent ? "Sent" : isSending ? "Sending…" : "Send"}
                  </button>
                </div>
              );
            })}

          {target === "group" &&
            !loading &&
            !loadError &&
            groups.map((group) => {
              const avatarUrl = group.groupPhoto ? getFullPhotoUrl(group.groupPhoto) : "";
              const initials = getInitials("", "", group.title);
              const key = recipientKey("group", group.id);
              const isSending = sendingKey === key;
              const isSent = sentKeys.has(key);

              return (
                <div
                  key={group.id}
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

                  <button
                    type="button"
                    onClick={() => handleSend(group.id)}
                    disabled={Boolean(sendingKey) || isSent}
                    className={`${styles.sendButton} ${isSent ? styles.sendButtonSent : ""}`}
                    aria-label={isSent ? `Sent to ${group.title}` : `Send to ${group.title}`}
                  >
                    {isSent && <span aria-hidden="true">✓</span>}
                    {isSent ? "Sent" : isSending ? "Sending…" : "Send"}
                  </button>
                </div>
              );
            })}
        </div>

        <div className={styles.modalFooter}>
          <p className={styles.shareStatus} aria-live="polite">
            {sharedCount > 0
              ? `Shared with ${sharedCount} ${sharedCount === 1 ? "recipient" : "recipients"}`
              : "Choose someone to share with"}
          </p>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
