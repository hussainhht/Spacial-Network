"use client";

import { useState } from "react";
import { useNotifications } from "../context/NotificationProvider";
import NotificationItem from "./NotificationItem";

type Filter = "all" | "unread";

export default function NotificationInbox() {
  const { notifications, loading, error, unreadCount, markAllAsRead, hasMore, loadingMore, loadMore, refresh } = useNotifications();
  const [readError, setReadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  async function markAll() {
    setMarking(true); setReadError(null);
    try { await markAllAsRead(); } catch { setReadError("Unable to mark all notifications read. Please retry."); } finally { setMarking(false); }
  }
  const [filter, setFilter] = useState<Filter>("all");

  const items = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="notifications-container">
      <header className="notifications-page-header">
        {unreadCount > 0 && (
          <button type="button" className="notification-mark-all" disabled={marking} onClick={() => void markAll()}>
            {marking ? "Marking…" : "Mark all as read"}
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

      {readError && <p className="form-error" role="alert">{readError}</p>}
      {loading && <p className="notification-status">Loading notifications…</p>}
      {!loading && error && <p className="form-error" role="alert">{error} <button type="button" className="group-button secondary" onClick={() => void refresh()}>Retry</button></p>}
      {!loading && !error && items.length === 0 && (
        <p className="notification-status">
          {filter === "unread" ? "No unread notifications." : "No notifications yet."}
        </p>
      )}
      {items.length > 0 && (
        <ul className="notification-list notification-list-page">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
      {hasMore && <button type="button" className="group-button secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more notifications"}</button>}
    </div>
  );
}
