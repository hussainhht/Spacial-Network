"use client";

import { useWebSocket } from "@/providers/WebSocketProvider";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { useSearchModal } from "@/features/search/context/SearchContext";
import AppIcon from "./AppIcon";
import styles from "./AppShell.module.css";

export default function AppHeader() {
  const { isConnected } = useWebSocket();
  const { openSearch } = useSearchModal();

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.search}
        onClick={openSearch}
        aria-label="Open universal search (⌘K)"
        style={{
          cursor: "pointer",
          border: "1px solid var(--space-border)",
          textAlign: "left",
        }}
      >
        <AppIcon name="search" />
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            color: "var(--space-text-muted)",
          }}
        >
          Search people, groups, posts, events…
        </span>
        <kbd
          style={{
            padding: "2px 6px",
            borderRadius: "5px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            fontSize: "10px",
            fontWeight: 600,
            color: "#94a3b8",
            letterSpacing: "0.5px",
          }}
        >
          ⌘K
        </kbd>
      </button>
      <div className={styles.headerActions}>
        <span className={styles.connection} data-connected={isConnected} role="status">
          <i aria-hidden="true" />{isConnected ? "Chat connected" : "Chat offline"}
        </span>
        <NotificationBell />
        <span className={styles.avatar} role="img" aria-label="Account details unavailable" title="Account details unavailable"><AppIcon name="user" /></span>
      </div>
    </header>
  );
}
