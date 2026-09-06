"use client";

import { useState } from "react";
import { useNotifications } from "../context/NotificationProvider";
import { useNotificationNavigate } from "../hooks/useNotificationNavigate";
import type { Notification, SupportedNotificationType } from "../types/notification";

const TYPE_LABELS: Record<SupportedNotificationType, string> = {
  group_invitation: "Group invitation",
  group_join_request: "Join request",
};


//! remove it after we have a proper date formatting  utility function in the frontend
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hr${diffHour === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
}

// Shared between the navbar dropdown and the /notifications inbox page.
export default function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const { markAsRead } = useNotifications();
  const navigateToNotification = useNotificationNavigate();
  const [navigating, setNavigating] = useState(false);

  async function handleClick() {
    if (navigating) return;
    setNavigating(true);

    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    try {
      await navigateToNotification(notification);
    } finally {
      setNavigating(false);
      onNavigate?.();
    }
  }

  return (
    <li className="notification-item" data-unread={!notification.isRead}>
      <button
        type="button"
        className="notification-item-button"
        onClick={handleClick}
        disabled={navigating}
      >
        <span className="notification-item-dot" aria-hidden="true" />
        <span className="notification-item-content">
          <span className="notification-item-type">{TYPE_LABELS[notification.type]}</span>
          <span className="notification-item-message">{notification.message}</span>
          <span className="notification-item-time">{formatRelativeTime(notification.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}
