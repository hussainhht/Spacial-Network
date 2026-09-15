"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getEligibleContacts } from "../api/chat";
import type { EligibleContact } from "../types/chat";
import { getDisplayName, getInitials } from "@/lib/utils";
import { getChatAvatarUrl } from "../utils/avatar";
import styles from "./Chat.module.css";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: EligibleContact) => void;
  onlineUserIDs: number[];
}

export default function NewChatModal(props: NewChatModalProps) {
  return props.isOpen ? createPortal(<NewChatDialog {...props} />, document.body) : null;
}

function NewChatDialog({
  onClose,
  onSelectContact,
  onlineUserIDs,
}: NewChatModalProps) {
  const [contacts, setContacts] = useState<EligibleContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    const trimmed = searchQuery.trim();
    const delay = trimmed ? 250 : 0;

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      getEligibleContacts(trimmed, 20, 0)
        .then((data) => {
          if (isMounted) {
            setContacts(data);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err instanceof Error ? err.message : "Failed to load contacts");
          }
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="new-chat-title"
    >
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="new-chat-title" className={styles.modalTitle}>
            New Transmission
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

        {/* Search */}
        <div className={styles.modalSearchWrapper}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              autoFocus
              placeholder="Search people you follow or followers..."
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

        {/* Contacts List */}
        <div className={styles.modalContactList}>
          {loading && contacts.length === 0 && (
            <div className={styles.loadingNotice}>
              {searchQuery.trim() ? "Searching contacts..." : "Finding eligible contacts..."}
            </div>
          )}

          {error && !loading && (
            <div className={styles.emptyNotice} style={{ color: "var(--space-error-text, #fca5a5)" }}>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  getEligibleContacts(searchQuery.trim(), 20, 0)
                    .then(setContacts)
                    .catch((e) => setError(e instanceof Error ? e.message : "Failed to load contacts"))
                    .finally(() => setLoading(false));
                }}
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "var(--planet-accent, #69aef0)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
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
                    You can only message users you follow or who follow you. Follow people to chat with them!
                  </p>
                </>
              )}
            </div>
          )}

          {!loading &&
            !error &&
            contacts.map((contact) => {
              const isOnline = onlineUserIDs.includes(contact.id);
              const displayName = getDisplayName(
                contact.first_name,
                contact.last_name,
                contact.username
              );
              const initials = getInitials(
                contact.first_name,
                contact.last_name,
                contact.username
              );
              const avatarUrl = getChatAvatarUrl(contact.profile_photo);

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    onSelectContact(contact);
                    onClose();
                  }}
                  className={styles.modalContactItem}
                >
                  <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className={styles.avatarImg}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {initials}
                      </div>
                    )}
                    <span
                      className={isOnline ? styles.onlineRing : styles.offlineDot}
                      title={isOnline ? "Online" : "Offline"}
                    />
                  </div>

                  <div className={styles.modalContactInfo}>
                    <span className={styles.modalContactName}>
                      {displayName}
                    </span>
                    <span className={styles.modalContactUsername}>
                      @{contact.username}
                    </span>
                  </div>

                  <span className={styles.mutualBadge}>
                    Mutual
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
