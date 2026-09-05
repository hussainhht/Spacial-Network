"use client";

import { useWebSocket } from "@/providers/WebSocketProvider";
import AppIcon from "./AppIcon";
import styles from "./AppShell.module.css";

export default function AppHeader() {
  const { isConnected } = useWebSocket();

  return (
    <header className={styles.header}>
      <div className={styles.search}>
        <AppIcon name="search" />
        {/* Temporary search UI – connect to real search later. Existing invite search is group-specific. */}
        <input type="search" placeholder="Search people, groups…" aria-label="Search people and groups (coming soon)" disabled />
        <span>Coming soon</span>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.connection} data-connected={isConnected} role="status">
          <i aria-hidden="true" />{isConnected ? "Chat connected" : "Chat offline"}
        </span>
        <button type="button" className={styles.iconButton} disabled title="Notifications page coming soon" aria-label="Notifications (coming soon)"><AppIcon name="bell" /></button>
        <span className={styles.avatar} role="img" aria-label="Account details unavailable" title="Account details unavailable"><AppIcon name="user" /></span>
      </div>
    </header>
  );
}
