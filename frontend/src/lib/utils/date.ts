/**
 * Date and time formatting utilities.
 * All timestamps are parsed as UTC and displayed in the client's local timezone.
 */

/**
 * Parses a date string safely into a Date object in the client's local timezone.
 * Handles:
 * - ISO strings with 'Z' (e.g. "2026-09-04T23:35:10Z")
 * - SQLite timestamps without timezone (e.g. "2026-09-04 23:35:10"), treating them as UTC
 * - Millisecond timestamps
 */
export function parseDate(dateStr?: string | number): Date | null {
  if (!dateStr) return null;
  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  // If timestamp lacks timezone indicator ('Z' or '+03:00'), treat as UTC
  if (!trimmed.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    const isoString = trimmed.replace(" ", "T") + "Z";
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a timestamp for chat message bubbles in client's local time (e.g. "02:30 PM").
 */
export function formatMessageTime(timeStr?: string): string {
  const d = parseDate(timeStr);
  if (!d) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Formats date and time for chat message bubbles in client's local time.
 * Returns:
 * - "Today, 02:30 PM" if today
 * - "Yesterday, 02:30 PM" if yesterday
 * - "MMM DD, 02:30 PM" if this year
 * - "MM/DD/YYYY, 02:30 PM" if older
 */
export function formatMessageDateTime(timeStr?: string): string {
  const d = parseDate(timeStr);
  if (!d) return "";
  try {
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today, ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday, ${time}`;
    }

    if (d.getFullYear() === now.getFullYear()) {
      const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${date}, ${time}`;
    }

    const date = d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
    return `${date}, ${time}`;
  } catch {
    return "";
  }
}

/**
 * Formats a date for conversation lists / sidebars in client's local time.
 * Returns:
 * - "HH:MM AM/PM" if today
 * - "Yesterday" if yesterday
 * - "MMM DD" (e.g. "Sep 4") if this year
 * - "MM/DD/YYYY" if older
 */
export function formatConversationDate(dateStr?: string): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  try {
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return "Yesterday";
    }

    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    return d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Formats a full date and time for posts or event details in client's local time (e.g. "Sep 5, 2026, 01:45 AM").
 */
export function formatDateTime(dateStr?: string): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  try {
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Formats relative time in client's local time (e.g., "just now", "5m ago", "2h ago", "3d ago").
 */
export function timeAgo(dateStr?: string): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  try {
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
