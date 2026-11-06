import type { AppIconName } from "@/components/layout/AppIcon";
import type {
  Notification,
  SupportedNotificationType,
} from "../types/notification";

// Display-only metadata shared by the inbox page, navbar dropdown, and toasts.

export const TYPE_LABELS: Record<SupportedNotificationType, string> = {
  follow_request: "Follow request",
  new_follower: "New follower",
  follow_accepted: "Follow accepted",
  group_invitation: "Group invitation",
  group_invitation_accepted: "Invitation accepted",
  group_invitation_declined: "Invitation declined",
  group_join_request: "Join request",
  group_join_accepted: "Join request accepted",
  group_join_rejected: "Join request declined",
  group_event: "Group event",
  event_rsvp: "Event response",
  group_message: "Group message",
  private_message: "Direct message",
  post_like: "Post like",
  post_comment: "New comment",
};

export const TYPE_ICONS: Record<SupportedNotificationType, AppIconName> = {
  follow_request: "userPlus",
  new_follower: "userPlus",
  follow_accepted: "userCheck",
  group_invitation: "mail",
  group_invitation_accepted: "groups",
  group_invitation_declined: "groups",
  group_join_request: "groups",
  group_join_accepted: "groups",
  group_join_rejected: "groups",
  group_event: "calendar",
  event_rsvp: "calendar",
  group_message: "chatGroup",
  private_message: "chat",
  post_like: "heart",
  post_comment: "comment",
};

export type NotificationCategory = "social" | "groups" | "messages";

const TYPE_CATEGORIES: Record<SupportedNotificationType, NotificationCategory> =
  {
    follow_request: "social",
    new_follower: "social",
    follow_accepted: "social",
    post_like: "social",
    post_comment: "social",
    group_invitation: "groups",
    group_invitation_accepted: "groups",
    group_invitation_declined: "groups",
    group_join_request: "groups",
    group_join_accepted: "groups",
    group_join_rejected: "groups",
    group_event: "groups",
    event_rsvp: "groups",
    private_message: "messages",
    group_message: "messages",
  };

export function getNotificationCategory(
  type: SupportedNotificationType,
): NotificationCategory {
  return TYPE_CATEGORIES[type];
}

export type NotificationFilter = "all" | "unread" | NotificationCategory;

export const NOTIFICATION_FILTERS: { id: NotificationFilter; label: string }[] =
  [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "social", label: "Social" },
    { id: "groups", label: "Groups" },
    { id: "messages", label: "Messages" },
  ];

// Filters only what has been loaded so far - callers must not present the
// result as the user's complete history while older pages remain.
export function filterNotifications(
  notifications: Notification[],
  filter: NotificationFilter,
): Notification[] {
  if (filter === "all") return notifications;
  if (filter === "unread") return notifications.filter((n) => !n.isRead);
  return notifications.filter((n) => TYPE_CATEGORIES[n.type] === filter);
}

export interface NotificationDayGroup {
  key: string;
  label: string;
  items: Notification[];
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayLabel(date: Date, now: Date): string {
  const today = localDayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = localDayKey(date);
  if (key === today) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

// Groups already newest-first notifications into consecutive local-time day
// buckets. Order is preserved, so each day heading appears exactly once.
export function groupNotificationsByDay(
  notifications: Notification[],
  parse: (value: string) => Date | null,
  now: Date = new Date(),
): NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  for (const notification of notifications) {
    const date = parse(notification.createdAt);
    const key = date ? localDayKey(date) : "unknown";
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: date ? dayLabel(date, now) : "Earlier", items: [] };
      groups.push(group);
    }
    group.items.push(notification);
  }
  return groups;
}
