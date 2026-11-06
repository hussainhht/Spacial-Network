"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { parseDate } from "@/lib/utils";
import { useNotifications } from "../context/NotificationProvider";
import {
  filterNotifications,
  groupNotificationsByDay,
  NOTIFICATION_FILTERS,
  type NotificationFilter,
} from "../utils/notificationPresentation";
import NotificationItem from "./NotificationItem";

const EMPTY_MESSAGES: Record<NotificationFilter, string> = {
  all: "No notifications yet.",
  unread: "You're all caught up.",
  social: "No social notifications.",
  groups: "No group notifications.",
  messages: "No message notifications.",
};

export default function NotificationInbox() {
  const { notifications, loading, error, unreadCount, markAllAsRead, hasMore, loadingMore, loadMore, refresh } = useNotifications();
  const [readError, setReadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  async function markAll() {
    setMarking(true); setReadError(null);
    try { await markAllAsRead(); } catch { setReadError("Unable to mark all notifications read. Please retry."); } finally { setMarking(false); }
  }
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const items = useMemo(() => filterNotifications(notifications, filter), [notifications, filter]);
  const days = useMemo(() => groupNotificationsByDay(items, parseDate), [items]);
  // Filters apply to loaded pages only; say so while older pages remain.
  const partial = hasMore && filter !== "all";

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = NOTIFICATION_FILTERS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setFilter(NOTIFICATION_FILTERS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="notifications-container">
      {/* The navbar already renders the "Notifications" page heading. */}
      <header className="notifications-page-header" data-motion-section>
        <p className="notifications-summary">
          {unreadCount > 0 ? (
            <><span className="notifications-unread-count">{unreadCount}</span> unread</>
          ) : (
            "All caught up"
          )}
        </p>
        {unreadCount > 0 && (
          <button type="button" className="notification-mark-all" disabled={marking} onClick={() => void markAll()}>
            <AppIcon name="check" />
            {marking ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </header>

      <div className="notifications-tabs" role="tablist" aria-label="Filter notifications" data-motion-section>
        {NOTIFICATION_FILTERS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            id={`notifications-tab-${tab.id}`}
            aria-controls="notifications-panel"
            aria-selected={filter === tab.id}
            tabIndex={filter === tab.id ? 0 : -1}
            data-active={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
          >
            {tab.label}
            {tab.id === "unread" && unreadCount > 0 && (
              <span className="notifications-tab-count">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      <section id="notifications-panel" role="tabpanel" aria-labelledby={`notifications-tab-${filter}`} className="notifications-panel">
        {readError && <p className="form-error" role="alert">{readError}</p>}
        {loading && (
          <div role="status">
            <span className="sr-only">Loading notifications…</span>
            <ul className="notification-skeleton" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <li key={i} />)}
            </ul>
          </div>
        )}
        {!loading && error && (
          <div className="notifications-error" role="alert">
            <AppIcon name="warning" />
            <span>{error}</span>
            <button type="button" className="group-button secondary" onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="notifications-empty">
            <span className="notifications-empty-icon" aria-hidden="true">
              <AppIcon name={filter === "unread" ? "check" : "bell"} />
            </span>
            <p>
              {EMPTY_MESSAGES[filter]}
              {partial && " Older notifications haven't been loaded yet."}
            </p>
          </div>
        )}
        {days.map((day, index) => (
          <section key={`${filter}-${day.key}-${index}`} className="notifications-day" aria-labelledby={`notifications-day-${index}`}>
            <h2 id={`notifications-day-${index}`} className="notifications-day-label">{day.label}</h2>
            <ul className="notification-list notification-list-page">
              {day.items.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} variant="full" />
              ))}
            </ul>
          </section>
        ))}
        {hasMore && !loading && (
          <div className="notifications-more">
            {partial && items.length > 0 && (
              <p className="notifications-more-note">Showing loaded notifications only.</p>
            )}
            <button type="button" className="group-button secondary" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>
              {loadingMore ? "Loading…" : "Load older notifications"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
