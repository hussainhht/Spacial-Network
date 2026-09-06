"use client";

import { useState } from "react";
import { InvitationActions, JoinRequestActions } from "@/features/groups/components/GroupResponseActions";
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
  const [readError, setReadError] = useState<string | null>(null);
  async function markRead() {
    try { await markAsRead(notification.id); setReadError(null); }
    catch { setReadError("Notification could not be marked read."); }
  }
  function handleClick() {
    if (!notification.isRead) void markRead();
    navigateToNotification(notification);
    onNavigate?.();
  }
  // Membership succeeded and Groups queries reconciled before this callback.
  // A notification read failure is displayed separately from the group action.
  async function afterAction() { await markRead(); }

  return (
    <li className="notification-item" data-unread={!notification.isRead}>
      <button
        type="button"
        className="notification-item-button"
        onClick={handleClick}
      >
        <span className="notification-item-dot" aria-hidden="true" />
        <span className="notification-item-content">
          <span className="notification-item-type">{TYPE_LABELS[notification.type]}</span>
          <span className="notification-item-message">{notification.actorUsername && `@${notification.actorUsername} `}{notification.message}</span>
          {notification.groupTitle && <span className="notification-group-title">{notification.groupTitle}</span>}
          <span className="notification-item-time">{formatRelativeTime(notification.createdAt)}</span>
        </span>
      </button>
      <div className="notification-actions">
        {notification.groupId && notification.entityId && notification.entityType === notification.type ? (
          notification.type === "group_invitation"
            ? <InvitationActions groupId={notification.groupId} entityId={notification.entityId} onSuccess={afterAction} />
            : <JoinRequestActions groupId={notification.groupId} entityId={notification.entityId} onSuccess={afterAction} />
        ) : <span className="group-muted">Group context unavailable</span>}
        {readError && <p className="form-error" role="alert">{readError} <button type="button" className="group-button secondary" onClick={() => void markRead()}>Retry mark read</button></p>}
      </div>
    </li>
  );
}
