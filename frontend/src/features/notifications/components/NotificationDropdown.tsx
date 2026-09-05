"use client";

import Link from "next/link";
import { useNotifications } from "../context/NotificationProvider";
import NotificationItem from "./NotificationItem";

const DROPDOWN_LIMIT = 5;

interface NotificationDropdownProps {
  onNavigate?: () => void;
}

export default function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const { notifications, loading, error } = useNotifications();
  const items = notifications.slice(0, DROPDOWN_LIMIT);

  return (
    <div className="notification-dropdown" role="menu" aria-label="Notifications">
      <div className="notification-dropdown-header">Notifications</div>

      <div className="notification-dropdown-body">
        {loading && <p className="notification-status">Loading…</p>}
        {!loading && error && <p className="notification-status notification-status-error">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="notification-status">No notifications yet.</p>
        )}
        {!loading && !error && items.length > 0 && (
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
