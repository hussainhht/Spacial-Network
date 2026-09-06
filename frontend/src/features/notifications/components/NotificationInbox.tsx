"use client";

import { useState } from "react";
import { useNotifications } from "../context/NotificationProvider";
import NotificationItem from "./NotificationItem";

type Filter = "all" | "unread";

export default function NotificationInbox() {
  const { notifications, loading, error, unreadCount, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const items = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="notifications-container">
      <header className="notifications-page-header">
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <button type="button" className="notification-mark-all" onClick={markAllAsRead}>
            Mark all as read
          </button>
        )}
      </header>

      <div className="notifications-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          data-active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "unread"}
          data-active={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Unread
        </button>
      </div>

      {loading && <p className="notification-status">Loading notifications…</p>}
      {!loading && error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="notification-status">
          {filter === "unread" ? "No unread notifications." : "No notifications yet."}
        </p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="notification-list notification-list-page">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </div>
  );
}
