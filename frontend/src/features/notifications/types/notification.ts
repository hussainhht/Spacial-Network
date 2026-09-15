import type { NotificationEventPayload } from "@/lib/websocket/types";

// Only these backend notification types are supported by the UI today.
export type SupportedNotificationType =
  | "follow_request"
  | "new_follower"
  | "follow_accepted"
  | "group_invitation"
  | "group_invitation_accepted"
  | "group_invitation_declined"
  | "group_join_request"
  | "group_join_accepted"
  | "group_join_rejected"
  | "group_event"
  | "event_rsvp"
  | "group_message"
  | "private_message"
  | "post_like"
  | "post_comment";

const SUPPORTED_NOTIFICATION_TYPES: readonly string[] = [
  "follow_request",
  "new_follower",
  "follow_accepted",
  "group_invitation",
  "group_invitation_accepted",
  "group_invitation_declined",
  "group_join_request",
  "group_join_accepted",
  "group_join_rejected",
  "group_event",
  "event_rsvp",
  "group_message",
  "private_message",
  "post_like",
  "post_comment",
];

export function isSupportedNotificationType(
  type: string,
): type is SupportedNotificationType {
  return SUPPORTED_NOTIFICATION_TYPES.includes(type);
}

// Raw shape returned by GET /notifications and pushed over the "notification"
// websocket event - identical fields either way (see
// backend/internal/notifications/{model,events}.go), so both sources are
// parsed the same way.
export type RawNotification = NotificationEventPayload;

// GroupNotificationData is the `data` payload for group_invitation and
// group_join_request notifications (see
// backend/internal/notifications/model.go). It is display/navigation
// context only, never authorization evidence - accepting/rejecting still
// goes through the Groups API, which re-checks the session user.
export interface GroupNotificationData {
  group_id: number;
  group_title: string;
  actor_username?: string;
}

export interface FollowNotificationData {
  actor_username: string;
}

function isGroupNotificationData(data: unknown): data is GroupNotificationData {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.group_id === "number" &&
    typeof candidate.group_title === "string"
  );
}

// getGroupNotificationData safely reads the group-shaped `data` field off
// any raw or mapped notification, returning null instead of throwing when
// it's missing or malformed. This is the one place that inspects `data`'s
// shape - callers get a typed GroupNotificationData back and never need an
// unsafe cast of their own.
export function getGroupNotificationData(notification: {
  data?: unknown;
}): GroupNotificationData | null {
  return isGroupNotificationData(notification.data) ? notification.data : null;
}

function isFollowNotificationData(
  data: unknown,
): data is FollowNotificationData {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return typeof candidate.actor_username === "string";
}

export function getFollowNotificationData(notification: {
  data?: unknown;
}): FollowNotificationData | null {
  return isFollowNotificationData(notification.data)
    ? notification.data
    : null;
}

export type NotificationData =
  | GroupNotificationData
  | FollowNotificationData
  | null;

export interface Notification {
  id: number;
  actorId: number | null;
  type: SupportedNotificationType;
  entityType: string | null;
  entityId: number | null;
  message: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
}

export function isGroupNotification(notification: Notification): boolean {
  return (
    notification.type === "group_invitation" ||
    notification.type === "group_join_request"
  );
}

export function isFollowNotification(notification: Notification): boolean {
  return (
    notification.type === "follow_request" ||
    notification.type === "new_follower" ||
    notification.type === "follow_accepted"
  );
}

// Adapts a raw backend notification into the frontend shape, or returns null
// for a notification type this UI doesn't render.
export function toNotification(raw: RawNotification): Notification | null {
  if (!isSupportedNotificationType(raw.type)) return null;
  // private_message, post_like, and post_comment notifications carry the same
  // { actor_username } shape as follow notifications (see backend
  // PrivateMessageNotificationData / FollowNotificationData reuse).
  const usesActorUsernameData =
    raw.type === "follow_request" ||
    raw.type === "new_follower" ||
    raw.type === "follow_accepted" ||
    raw.type === "private_message" ||
    raw.type === "post_like" ||
    raw.type === "post_comment";
  const data = usesActorUsernameData
    ? getFollowNotificationData(raw)
    : getGroupNotificationData(raw);

  return {
    id: raw.id,
    actorId: raw.actor_id ?? null,
    type: raw.type,
    entityType: raw.entity_type ?? null,
    entityId: raw.entity_id ?? null,
    message: raw.message,
    data,
    isRead: raw.read_at != null,
    createdAt: raw.created_at,
  };
}
