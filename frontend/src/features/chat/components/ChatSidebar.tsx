"use client";

import { useMemo, useState } from "react";
import type { ChatSidebarProps } from "../types/chat";
import { formatConversationDate, getDisplayName, getInitials } from "@/lib/utils";

export default function ChatSidebar({
  conversations,
  activeUserId,
  onlineUserIDs,
  loading,
  onSelectConversation,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.partner_username.toLowerCase().includes(q) ||
        c.partner_first_name.toLowerCase().includes(q) ||
        c.partner_last_name.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <h2 style={styles.title}>Messages</h2>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={styles.clearSearchBtn}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div style={styles.listContainer}>
        {loading && <p style={styles.emptyText}>Loading conversations...</p>}

        {!loading && filteredConversations.length === 0 && (
          <p style={styles.emptyText}>
            {searchQuery ? "No matching contacts found." : "No conversations yet."}
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

            return (
              <div
                key={c.partner_id}
                onClick={() => onSelectConversation(c.partner_id, c.partner_username)}
                style={{
                  ...styles.conversationItem,
                  ...(isActive ? styles.activeItem : {}),
                }}
              >
                <div style={styles.avatarWrapper}>
                  {c.partner_avatar ? (
                    <img
                      src={c.partner_avatar}
                      alt={displayName}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <div style={styles.avatarPlaceholder}>{initials}</div>
                  )}
                  <span
                    style={{
                      ...styles.statusDot,
                      background: isOnline ? "#22c55e" : "#94a3b8",
                    }}
                    title={isOnline ? "Online" : "Offline"}
                  />
                </div>

                <div style={styles.details}>
                  <div style={styles.topRow}>
                    <span style={styles.name}>{displayName}</span>
                    <span style={styles.time}>
                      {formatConversationDate(c.last_message_at)}
                    </span>
                  </div>

                  <div style={styles.bottomRow}>
                    <span style={styles.snippet}>
                      {c.last_message || "No messages yet"}
                    </span>
                    {c.unread_count > 0 && (
                      <span style={styles.unreadBadge}>{c.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}


const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "320px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(11, 16, 38, 0.7)",
    backdropFilter: "blur(8px)",
    height: "100%",
  },
  header: {
    padding: "1.25rem 1rem",
    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
  },
  title: {
    margin: "0 0 0.75rem 0",
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#f8fafc",
  },
  searchContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    background: "rgba(16, 21, 47, 0.8)",
    color: "#f8fafc",
    fontSize: "0.875rem",
    outline: "none",
  },
  clearSearchBtn: {
    position: "absolute",
    right: "8px",
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "1rem",
    cursor: "pointer",
  },
  listContainer: {
    flex: 1,
    overflowY: "auto",
  },
  emptyText: {
    padding: "2rem 1rem",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "0.875rem",
  },
  conversationItem: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    gap: "12px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
  },
  activeItem: {
    background: "rgba(99, 102, 241, 0.15)",
    borderLeft: "3px solid #6366f1",
  },
  avatarWrapper: {
    position: "relative",
    flexShrink: 0,
    width: "44px",
    height: "44px",
  },
  avatarImg: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  avatarPlaceholder: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #3b82f6)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: "0.875rem",
  },
  statusDot: {
    position: "absolute",
    bottom: "1px",
    right: "1px",
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    border: "2px solid #0b1026",
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "4px",
  },
  name: {
    fontWeight: 600,
    fontSize: "0.92rem",
    color: "#f1f5f9",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  time: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    flexShrink: 0,
    marginLeft: "8px",
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "6px",
  },
  snippet: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  unreadBadge: {
    background: "#6366f1",
    color: "#ffffff",
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "999px",
    flexShrink: 0,
  },
};
