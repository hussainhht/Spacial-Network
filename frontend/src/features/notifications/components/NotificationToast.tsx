"use client";

import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import { useNotifications } from "../context/NotificationProvider";
import { useNotificationNavigate } from "../hooks/useNotificationNavigate";
import {
  getFollowNotificationData,
  getGroupNotificationData,
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

const TYPE_ICONS: Record<SupportedNotificationType, AppIconName> = {
  follow_request: "user",
  new_follower: "user",
  follow_accepted: "user",
  group_invitation: "groups",
  group_join_request: "groups",
  private_message: "chat",
};

interface NotificationToastProps {
  notification: Notification;
  leaving: boolean;
  onDismiss: () => void;
}

export default function NotificationToast({
  notification,
  leaving,
  onDismiss,
}: NotificationToastProps) {
  const { markAsRead } = useNotifications();
  const navigateToNotification = useNotificationNavigate();

  const groupData = getGroupNotificationData(notification);
  const followData = getFollowNotificationData(notification);
  const actorUsername = groupData?.actor_username ?? followData?.actor_username;
  // Keep the DM's content out of a transient, glanceable popup - just who sent it.
  const messageText =
    notification.type === "private_message" && actorUsername
      ? "sent a message"
      : notification.message;

  function handleClick() {
    if (!notification.isRead) void markAsRead(notification.id).catch(() => {});
    navigateToNotification(notification);
    onDismiss();
  }

  return (
    <div className="notification-toast" data-leaving={leaving} role="status">
      <button
        type="button"
        className="notification-toast-button"
        onClick={handleClick}
      >
        <span className="notification-toast-icon">
          <AppIcon name={TYPE_ICONS[notification.type]} />
        </span>
        <span className="notification-toast-content">
          <span className="notification-toast-type">
            {TYPE_LABELS[notification.type]}
          </span>
          <span className="notification-toast-message">
            {actorUsername && `@${actorUsername} `}
            {messageText}
          </span>
          {groupData?.group_title && (
            <span className="notification-toast-meta">
              {groupData.group_title}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        className="notification-toast-close"
        aria-label="Dismiss notification"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
      >
        <AppIcon name="x" />
      </button>
    </div>
  );
}
