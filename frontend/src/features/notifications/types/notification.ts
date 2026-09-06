import type { NotificationEventPayload } from "@/lib/websocket/types";

// Only these two backend notification types are supported by the UI today
// (see backend/internal/notifications/model.go - "follow_request" and
// "group_event" also exist backend-side but have no frontend yet).
export type SupportedNotificationType =
  | "group_invitation"
  | "group_join_request";

const SUPPORTED_NOTIFICATION_TYPES: readonly string[] = [
  "group_invitation",
  "group_join_request",
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
// backend/internal/notifications/group_data.go). It is display/navigation
// context only, never authorization evidence - accepting/rejecting still
// goes through the Groups API, which re-checks the session user.
export interface GroupNotificationData {
  group_id: number;
  group_title: string;
  actor_username?: string;
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

export interface Notification {
  id: number;
  actorId: number | null;
  type: SupportedNotificationType;
  entityType: string | null;
  entityId: number | null;
  message: string;
  data: GroupNotificationData | null;
  isRead: boolean;
  createdAt: string;
}

export function isGroupNotification(notification: Notification): boolean {
  return (
    notification.type === "group_invitation" ||
    notification.type === "group_join_request"
  );
}

// Adapts a raw backend notification into the frontend shape, or returns null
// for a notification type this UI doesn't render (per scope: only group
// invitations and group join requests).
export function toNotification(raw: RawNotification): Notification | null {
  if (!isSupportedNotificationType(raw.type)) return null;
  return {
    id: raw.id,
    actorId: raw.actor_id ?? null,
    type: raw.type,
    entityType: raw.entity_type ?? null,
    entityId: raw.entity_id ?? null,
    message: raw.message,
    data: getGroupNotificationData(raw),
    isRead: raw.read_at != null,
    createdAt: raw.created_at,
  };
}
