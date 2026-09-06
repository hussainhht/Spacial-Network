"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { toNotification, type Notification } from "../types/notification";
import { mergeNotifications } from "../utils/mergeNotifications";

const PAGE_SIZE = 50;

export interface NotificationSyncState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => void;
}

export function useNotificationSync(): NotificationSyncState {
  const { isConnected, subscribeNotifications } = useWebSocket();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadedPagesRef = useRef(1);
  const mountedRef = useRef(false);
  const refreshRequestRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const dataVersionRef = useRef(0);
  const markReadRequestsRef = useRef(new Map<number, Promise<void>>());
  const markAllReadRequestRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    refreshQueuedRef.current = true;

    if (refreshRequestRef.current) return refreshRequestRef.current;

    const task = Promise.resolve()
      .then(async () => {
        while (refreshQueuedRef.current && mountedRef.current) {
          refreshQueuedRef.current = false;
          const startedAtVersion = dataVersionRef.current;
          try {
            const [rawPages, count] = await Promise.all([
              Promise.all(
                Array.from({ length: loadedPagesRef.current }, (_, page) =>
                  fetchNotifications(PAGE_SIZE, page * PAGE_SIZE),
                ),
              ),
              fetchUnreadCount(),
            ]);
            if (!mountedRef.current) return;
            const mapped = rawPages
              .flat()
              .map(toNotification)
              .filter((n): n is Notification => n !== null);
            setNotifications((current) => mergeNotifications(current, mapped));
            setHasMore(rawPages.at(-1)?.length === PAGE_SIZE);
            if (startedAtVersion === dataVersionRef.current) {
              setUnreadCount(count);
            } else {
              refreshQueuedRef.current = true;
            }
            setError(null);
          } catch (err) {
            if (mountedRef.current)
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to refresh notifications",
              );
          } finally {
            if (mountedRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
          }
        }
      })
      .finally(() => {
        refreshRequestRef.current = null;
      });
    refreshRequestRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = subscribeNotifications((raw) => {
      dataVersionRef.current++;

      const notification = toNotification(raw);

      if (notification)
        setNotifications((current) =>
          mergeNotifications(current, [notification]),
        );

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refresh();
      }, 50);
    });

    void refresh();
    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      mountedRef.current = false;
      unsubscribe();
      clearTimeout(debounceTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh, subscribeNotifications]);

  useEffect(() => {
    if (isConnected) void refresh();
  }, [isConnected, refresh]);

  const markAsRead = useCallback(
    (id: number): Promise<void> => {
      const existing = markReadRequestsRef.current.get(id);

      if (existing) return existing;

      dataVersionRef.current++;

      const task = markNotificationRead(id)
        .then(() => {
          if (mountedRef.current)
            setNotifications((current) =>
              current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
            );
        })
        .catch((err) => {
          if (mountedRef.current)
            setError(
              "Unable to mark notification read. Retry after reconnecting.",
            );
          throw err;
        })
        .finally(async () => {
          dataVersionRef.current++;
          await refresh();
          markReadRequestsRef.current.delete(id);
        });
      markReadRequestsRef.current.set(id, task);
      return task;
    },
    [refresh],
  );

  const markAllAsRead = useCallback((): Promise<void> => {
    if (markAllReadRequestRef.current) return markAllReadRequestRef.current;
    dataVersionRef.current++;

    const task = markAllNotificationsRead()
      .catch((err) => {
        if (mountedRef.current)
          setError("Unable to mark notifications read. Please retry.");
        throw err;
      })
      .finally(async () => {
        dataVersionRef.current++;
        await refresh();
        markAllReadRequestRef.current = null;
      });
    markAllReadRequestRef.current = task;
    return task;
  }, [refresh]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshRequestRef.current) return;
    loadedPagesRef.current++;
    setLoadingMore(true);
    void refresh();
  }, [hasMore, loadingMore, refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    loadingMore,
    markAsRead,
    markAllAsRead,
    refresh,
    loadMore,
  };
}
