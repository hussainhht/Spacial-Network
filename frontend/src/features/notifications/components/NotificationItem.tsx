"use client";

import { useState } from "react";
import {
  InvitationActions,
  JoinRequestActions,
} from "@/features/groups/components/GroupResponseActions";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import { timeAgo } from "@/lib/utils";
import { useNotifications } from "../context/NotificationProvider";
import { useNotificationNavigate } from "../hooks/useNotificationNavigate";
import {
  getFollowNotificationData,
  getGroupNotificationData,
  isGroupNotification,
  type Notification,
  type SupportedNotificationType,
} from "../types/notification";

const TYPE_LABELS: Record<SupportedNotificationType, string> = {
  follow_request: "Follow request",
  new_follower: "New follower",
  follow_accepted: "Follow accepted",
  group_invitation: "Group invitation",
  group_join_request: "Join request",
  private_message: "Direct message",
};

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
}

// Shared between the navbar dropdown and the /notifications inbox page.
export default function NotificationItem({
  notification,
  onNavigate,
}: NotificationItemProps) {
  const { markAsRead } = useNotifications();
  const navigateToNotification = useNotificationNavigate();
  const [readError, setReadError] = useState<string | null>(null);
  async function markRead() {
    try {
      await markAsRead(notification.id);
      setReadError(null);
    } catch {
      setReadError("Notification could not be marked read.");
    }
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
  // A private_message notification's message is raw chat content, which for a
  // shared post is a /posts/<id> link (+ optional note) - never show that
  // raw link/id, mirror ChatSidebar's "sent a post" convention instead.
  const sharedPost =
    notification.type === "private_message"
      ? parseSharedPost(notification.message)
      : null;
  const messageText = sharedPost ? "sent a post" : notification.message;

  return (
    <li className="notification-item" data-unread={!notification.isRead}>
      <button
        type="button"
        className="notification-item-button"
        onClick={handleClick}
      >
        <span className="notification-item-dot" aria-hidden="true" />
        <span className="notification-item-content">
          <span className="notification-item-type">
            {TYPE_LABELS[notification.type]}
          </span>
          <span className="notification-item-message">
            {actorUsername && `@${actorUsername} `}
            {messageText}
          </span>
          {groupData?.group_title && (
            <span className="notification-group-title">
              {groupData.group_title}
            </span>
          )}
          <span className="notification-item-time">
            {timeAgo(notification.createdAt)}
          </span>
        </span>
      </button>
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
          {readError && (
            <p className="form-error" role="alert">
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
        </div>
      )}
    </li>
  );
}
