"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { toNotification, type Notification } from "../types/notification";

export interface NotificationToastEntry {
  toastId: number;
  notification: Notification;
  leaving: boolean;
}

const TOAST_DURATION_MS = 6000;
const TOAST_EXIT_MS = 220;
const MAX_TOASTS = 4;

let toastSeq = 0;

// Toasts are driven only by live websocket pushes (subscribeNotifications),
// never by the REST-loaded/initial notification list - so page load, refresh,
// and navigation never spawn a toast, only a genuinely new push does.
export function useNotificationToasts() {
  const { subscribeNotifications } = useWebSocket();
  const [toasts, setToasts] = useState<NotificationToastEntry[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((toastId: number) => {
    const timer = timersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(toastId);
    }
  }, []);

  const remove = useCallback(
    (toastId: number) => {
      clearTimer(toastId);
      setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    },
    [clearTimer],
  );

  const dismiss = useCallback(
    (toastId: number) => {
      clearTimer(toastId);
      setToasts((prev) =>
        prev.map((t) => (t.toastId === toastId ? { ...t, leaving: true } : t)),
      );
      setTimeout(() => remove(toastId), TOAST_EXIT_MS);
    },
    [clearTimer, remove],
  );

  useEffect(() => {
    const unsubscribe = subscribeNotifications((raw) => {
      const notification = toNotification(raw);
      if (!notification) return;

      const toastId = ++toastSeq;
      setToasts((prev) => {
        const next = [...prev, { toastId, notification, leaving: false }];
        const overflow = next.length - MAX_TOASTS;
        if (overflow <= 0) return next;
        // Silently drop the oldest toasts once the stack is full, clearing
        // their timers so they don't fire dismiss() on an already-gone entry.
        next.slice(0, overflow).forEach((t) => clearTimer(t.toastId));
        return next.slice(overflow);
      });

      const timer = setTimeout(() => dismiss(toastId), TOAST_DURATION_MS);
      timersRef.current.set(toastId, timer);
    });

    return unsubscribe;
  }, [subscribeNotifications, dismiss, clearTimer]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return { toasts, dismiss };
}
