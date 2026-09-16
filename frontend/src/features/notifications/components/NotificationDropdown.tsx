"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifications } from "../context/NotificationProvider";
import NotificationItem from "./NotificationItem";

const DROPDOWN_LIMIT = 5;

interface NotificationDropdownProps {
  onNavigate?: () => void;
}

export default function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const { notifications, loading, error, unreadCount, markAllAsRead, refresh } = useNotifications();
  const [readError, setReadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  async function markAll() {
    setMarking(true); setReadError(null);
    try { await markAllAsRead(); } catch { setReadError("Unable to mark all notifications read. Please retry."); } finally { setMarking(false); }
  }
  const items = notifications.slice(0, DROPDOWN_LIMIT);

  return (
    <div className="notification-dropdown" role="region" aria-label="Notifications">
      <div className="notification-dropdown-header">
        <span>Notifications</span>
        {unreadCount > 0 && (
          <button type="button" className="notification-mark-all" disabled={marking} onClick={() => void markAll()}>
            {marking ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>

      <div className="notification-dropdown-body">
        {readError && <p className="notification-status notification-status-error">{readError}</p>}
        {loading && <p className="notification-status">Loading…</p>}
        {!loading && error && <p className="notification-status notification-status-error">{error} <button type="button" className="group-button secondary" onClick={() => void refresh()}>Retry</button></p>}
        {!loading && !error && items.length === 0 && (
          <p className="notification-status">No notifications yet.</p>
        )}
        {items.length > 0 && (
          <ul className="notification-list">
            {items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </div>

      <Link href="/notifications" className="notification-dropdown-footer" onClick={onNavigate}>
        View all notifications
      </Link>
    </div>
  );
}
