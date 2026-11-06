"use client";

import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import {
  InvitationActions,
  JoinRequestActions,
} from "@/features/groups/components/GroupResponseActions";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import { parseDate, timeAgo } from "@/lib/utils";
import { useNotifications } from "../context/NotificationProvider";
import { useNotificationNavigate } from "../hooks/useNotificationNavigate";
import {
  getFollowNotificationData,
  getGroupNotificationData,
  isGroupNotification,
  type Notification,
} from "../types/notification";
import {
  getNotificationCategory,
  TYPE_ICONS,
  TYPE_LABELS,
} from "../utils/notificationPresentation";

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
  // "compact" keeps the navbar dropdown dense; "full" is the inbox page row
  // with a message preview and a per-row mark-as-read control.
  variant?: "compact" | "full";
}

// Shared between the navbar dropdown and the /notifications inbox page.
export default function NotificationItem({
  notification,
  onNavigate,
  variant = "compact",
}: NotificationItemProps) {
  const { markAsRead } = useNotifications();
  const navigateToNotification = useNotificationNavigate();
  const [readError, setReadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  async function markRead() {
    try {
      await markAsRead(notification.id);
      setReadError(null);
    } catch {
      setReadError("Notification could not be marked read.");
    }
  }
  async function markReadOnly() {
    setMarking(true);
    await markRead();
    setMarking(false);
  }
  function handleClick() {
    if (!notification.isRead) void markRead();
    navigateToNotification(notification);
    onNavigate?.();
  }
  // Membership succeeded and Groups queries reconciled before this callback.
  // A notification read failure is displayed separately from the group action.
  async function afterAction() {
    await markRead();
  }

  const groupData = getGroupNotificationData(notification);
  const followData = getFollowNotificationData(notification);
  const actorUsername = groupData?.actor_username ?? followData?.actor_username;
  // A private_message/group_message notification's message is raw chat
  // content, which for a shared post is a /posts/<id> link (+ optional note)
  // - never show that raw link/id, mirror ChatSidebar's "sent a post"
  // convention instead.
  const isChatMessage =
    notification.type === "private_message" ||
    notification.type === "group_message";
  const sharedPost = isChatMessage
    ? parseSharedPost(notification.message)
    : null;
  // With a known sender, chat content moves to a preview line under a short
  // "sent a message" summary so the sender stays the scannable subject.
  const preview =
    isChatMessage && actorUsername && !sharedPost && variant === "full"
      ? notification.message
      : null;
  const messageText = sharedPost
    ? "sent a post"
    : preview
      ? "sent a message"
      : notification.message;
  const createdAt = parseDate(notification.createdAt);
  const unread = !notification.isRead;

  return (
    <li
      className="notification-item"
      data-unread={unread}
      data-variant={variant}
    >
      <div className="notification-item-row">
        <button
          type="button"
          className="notification-item-button"
          onClick={handleClick}
        >
          <span
            className="notification-item-icon"
            data-category={getNotificationCategory(notification.type)}
            aria-hidden="true"
          >
            <AppIcon name={TYPE_ICONS[notification.type]} />
          </span>
          <span className="notification-item-content">
            <span className="sr-only">
              {unread ? "Unread. " : ""}
              {TYPE_LABELS[notification.type]}:{" "}
            </span>
            <span className="notification-item-message">
              {actorUsername && (
                <strong className="notification-item-actor">
                  @{actorUsername}
                </strong>
              )}{" "}
              {messageText}
            </span>
            {preview && (
              <span className="notification-item-preview">{preview}</span>
            )}
            <span className="notification-item-meta">
              {groupData?.group_title && (
                <span className="notification-group-title">
                  {groupData.group_title}
                </span>
              )}
              <time
                className="notification-item-time"
                dateTime={createdAt?.toISOString()}
                title={createdAt?.toLocaleString()}
              >
                {timeAgo(notification.createdAt)}
              </time>
            </span>
          </span>
          <span className="notification-item-dot" aria-hidden="true" />
        </button>
        {variant === "full" && unread && (
          <button
            type="button"
            className="notification-item-mark"
            aria-label="Mark notification as read"
            title="Mark as read"
            disabled={marking}
            onClick={() => void markReadOnly()}
          >
            <AppIcon name="check" />
          </button>
        )}
      </div>
      {isGroupNotification(notification) && (
        <div className="notification-actions">
          {groupData &&
          notification.entityId &&
          notification.entityType === notification.type ? (
            notification.type === "group_invitation" ? (
              <InvitationActions
                groupId={groupData.group_id}
                entityId={notification.entityId}
                onSuccess={afterAction}
              />
            ) : (
              <JoinRequestActions
                groupId={groupData.group_id}
                entityId={notification.entityId}
                onSuccess={afterAction}
              />
            )
          ) : (
            <span className="group-muted">Group context unavailable</span>
          )}
        </div>
      )}
      {readError && (
        <p className="form-error notification-item-error" role="alert">
          {readError}{" "}
          <button
            type="button"
            className="group-button secondary"
            onClick={() => void markRead()}
          >
            Retry mark read
          </button>
        </p>
      )}
    </li>
  );
}
