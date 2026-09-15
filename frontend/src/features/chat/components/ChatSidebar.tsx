"use client";

import { useMemo, useState } from "react";
import type { ChatSidebarProps } from "../types/chat";
import { formatConversationDate, getDisplayName, getInitials } from "@/lib/utils";
import NewChatModal from "./NewChatModal";
import { getChatAvatarUrl } from "../utils/avatar";
import styles from "./Chat.module.css";

export default function ChatSidebar({
  conversations,
  activeUserId,
  onlineUserIDs,
  loading,
  onSelectConversation,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "online">("all");

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab === "unread" && (!c.unread_count || c.unread_count <= 0)) {
        return false;
      }
      if (activeTab === "online" && !onlineUserIDs.includes(c.partner_id)) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.partner_username.toLowerCase().includes(q) ||
        c.partner_first_name.toLowerCase().includes(q) ||
        c.partner_last_name.toLowerCase().includes(q)
      );
    });
  }, [conversations, activeTab, onlineUserIDs, searchQuery]);

  return (
    <aside className={styles.floatingCard}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitleRow}>
          <div className={styles.sidebarTitleGroup}>
            <h2 className={styles.sidebarTitle}>Messages</h2>
            {totalUnread > 0 && (
              <span className={styles.unreadCountBadge}>{totalUnread}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsNewChatOpen(true)}
            className={styles.newChatBtn}
            title="Start a new chat"
          >
            <span>+</span> New Chat
          </button>
        </div>

        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search conversations..."
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

        <div className={styles.filterChips}>
          {(["all", "unread", "online"] as const).map((tab) => {
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.conversationsList}>
        {loading && (
          <p className={styles.loadingNotice}>
            Loading conversations...
          </p>
        )}

        {!loading && filteredConversations.length === 0 && (
          <p className={styles.emptyNotice}>
            {searchQuery
              ? "No matching contacts found."
              : activeTab === "unread"
              ? "No unread messages."
              : activeTab === "online"
              ? "No contacts currently online."
              : "No conversations yet."}
          </p>
        )}

        {!loading &&
          filteredConversations.map((c) => {
            const isOnline = onlineUserIDs.includes(c.partner_id);
            const isActive = activeUserId === c.partner_id;
            const displayName = getDisplayName(
              c.partner_first_name,
              c.partner_last_name,
              c.partner_username
            );
            const initials = getInitials(
              c.partner_first_name,
              c.partner_last_name,
              c.partner_username
            );
            const avatarUrl = getChatAvatarUrl(c.partner_avatar);

            return (
              <div
                key={c.partner_id}
                onClick={() => onSelectConversation(c.partner_id, c.partner_username, c.partner_avatar)}
                className={`${styles.conversationItem} ${
                  isActive ? styles.conversationItemActive : ""
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectConversation(c.partner_id, c.partner_username, c.partner_avatar);
                  }
                }}
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

                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>
                      {displayName}
                    </span>
                    <span className={styles.itemTime}>
                      {formatConversationDate(c.last_message_at)}
                    </span>
                  </div>

                  <div className={styles.itemFooter}>
                    <span
                      className={`${styles.itemSnippet} ${
                        c.unread_count > 0 ? styles.itemSnippetUnread : ""
                      }`}
                    >
                      {c.last_message || "No messages yet"}
                    </span>
                    {c.unread_count > 0 && (
                      <span className={styles.itemUnreadPill}>
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectContact={(contact) => {
          onSelectConversation(contact.id, contact.username, contact.profile_photo);
          setIsNewChatOpen(false);
        }}
        onlineUserIDs={onlineUserIDs}
      />
    </aside>
  );
}
