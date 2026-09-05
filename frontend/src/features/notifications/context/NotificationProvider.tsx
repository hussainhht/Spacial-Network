"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { toNotification, type Notification } from "../types/notification";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Single source of truth for notification state, shared by the navbar bell,
// its dropdown, and the /notifications page. Loads existing notifications
// over REST once, then layers in real-time updates from the existing
// WebSocketProvider (no new socket connection is created here).
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { lastNotification } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [raw, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
        if (cancelled) return;
        const mapped = raw
          .map(toNotification)
          .filter((n): n is Notification => n !== null);
        setNotifications(mapped);
        setUnreadCount(count);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load notifications");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Layers a new real-time notification into state as it arrives. This
  // follows React's "adjusting state during render" pattern (comparing
  // against the last-seen websocket payload) rather than a useEffect, so a
  // brand-new notification is applied on the same render instead of an
  // extra effect pass. Duplicate protection: a notification whose ID is
  // already in `notifications` (e.g. already loaded via REST) is skipped.
  const [lastHandledNotification, setLastHandledNotification] = useState(lastNotification);
  if (lastNotification !== lastHandledNotification) {
    setLastHandledNotification(lastNotification);
    const mapped = lastNotification ? toNotification(lastNotification) : null;
    if (mapped && !notifications.some((n) => n.id === mapped.id)) {
      setNotifications((prev) => [mapped, ...prev]);
      if (!mapped.isRead) setUnreadCount((prev) => prev + 1);
    }
  }

  const markAsRead = useCallback((id: number) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || target.isRead) return prev;
      return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    });
    setUnreadCount((prev) => Math.max(0, prev - 1));

    markNotificationRead(id).catch(() => {
      // Best-effort: revert on failure so the badge/list stay accurate.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      setUnreadCount((prev) => prev + 1);
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    let hadUnread = false;
    setNotifications((prev) => {
      hadUnread = prev.some((n) => !n.isRead);
      return prev.map((n) => ({ ...n, isRead: true }));
    });
    setUnreadCount(0);

    markAllNotificationsRead().catch(() => {
      if (hadUnread) {
        // Best-effort: we don't know the prior per-item state anymore, so
        // just re-sync unread count from the server rather than guessing.
        fetchUnreadCount().then(setUnreadCount).catch(() => {});
      }
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, error, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
