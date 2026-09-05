"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { useNotifications } from "../context/NotificationProvider";
import NotificationDropdown from "./NotificationDropdown";
import styles from "@/components/layout/AppShell.module.css";

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className={styles.notificationWrapper} ref={containerRef}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        title="Notifications"
      >
        <AppIcon name="bell" />
        {unreadCount > 0 && (
          <span className={styles.notificationBadge} aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onNavigate={() => setOpen(false)} />}
    </div>
  );
}
