import type { Notification } from "../types/notification";

// Merges by ID and keeps the newest fields, but read state only moves
// forward: an older REST/WebSocket payload can never flip a read
// notification back to unread.
export function mergeNotifications(
  current: Notification[],
  incoming: Notification[],
): Notification[] {
  const map = new Map(current.map((n) => [n.id, n]));
  for (const n of incoming) {
    const previous = map.get(n.id);
    map.set(n.id, { ...n, isRead: n.isRead || Boolean(previous?.isRead) });
  }
  return [...map.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  );
}
