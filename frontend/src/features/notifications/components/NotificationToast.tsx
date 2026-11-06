"use client";

import AppIcon from "@/components/layout/AppIcon";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import { useNotifications } from "../context/NotificationProvider";
import { useNotificationNavigate } from "../hooks/useNotificationNavigate";
import {
  getFollowNotificationData,
  getGroupNotificationData,
  type Notification,
} from "../types/notification";
import { TYPE_ICONS, TYPE_LABELS } from "../utils/notificationPresentation";

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
  // Keep the DM/group message's content out of a transient, glanceable popup
  // - just who sent it. A shared post's raw /posts/<id> link never leaks;
  // it's always "sent a post", matching ChatSidebar's convention for shared
  // posts elsewhere.
  const isChatMessage =
    notification.type === "private_message" ||
    notification.type === "group_message";
  const sharedPost = isChatMessage
    ? parseSharedPost(notification.message)
    : null;
  const messageText =
    sharedPost
      ? "sent a post"
      : isChatMessage && actorUsername
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
