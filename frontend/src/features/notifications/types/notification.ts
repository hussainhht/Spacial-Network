import type { NotificationEventPayload } from "@/lib/websocket/types";

// Only these two backend notification types are supported by the UI today
// (see backend/internal/notifications/model.go - "follow_request" and
// "group_event" also exist backend-side but have no frontend yet).
export type SupportedNotificationType = "group_invitation" | "group_join_request";

const SUPPORTED_NOTIFICATION_TYPES: readonly string[] = [
  "group_invitation",
  "group_join_request",
];

export function isSupportedNotificationType(type: string): type is SupportedNotificationType {
  return SUPPORTED_NOTIFICATION_TYPES.includes(type);
}

// Raw shape returned by GET /notifications and pushed over the "notification"
// websocket event - identical fields either way (see
// backend/internal/notifications/{model,events}.go), so both sources are
// parsed the same way.
export type RawNotification = NotificationEventPayload;

export interface Notification {
  id: number;
  actorId: number | null;
  type: SupportedNotificationType;
  entityType: string | null;
  entityId: number | null;
  message: string;
  isRead: boolean;
  createdAt: string;
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
    isRead: raw.read_at != null,
    createdAt: raw.created_at,
  };
}
