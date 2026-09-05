// Client for the Go backend's Notifications API (see
// backend/internal/notifications). Follows the same apiRequest convention as
// features/posts/api/posts.ts - the backend's response envelope here is
// {message|error} on writes and the bare data on reads, which is exactly
// what apiRequest expects.

import { apiRequest } from "@/lib/api/client";
import type { RawNotification } from "../types/notification";

interface ListNotificationsResponse {
  notifications: RawNotification[];
}

interface UnreadCountResponse {
  count: number;
}

export async function fetchNotifications(limit?: number, offset?: number): Promise<RawNotification[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (offset !== undefined) params.set("offset", String(offset));
  const query = params.toString();

  const data = await apiRequest<ListNotificationsResponse>(
    `/notifications${query ? `?${query}` : ""}`
  );
  return data.notifications;
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiRequest<UnreadCountResponse>("/notifications/unread-count");
  return data.count;
}

export function markNotificationRead(id: number): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>("/notifications/read-all", { method: "PATCH" });
}
