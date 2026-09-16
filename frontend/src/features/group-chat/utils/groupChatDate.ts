import { parseDate, formatMessageTime } from "@/lib/utils";

export { formatMessageTime };

export function isSameCalendarDay(dateA?: string, dateB?: string): boolean {
  const dA = parseDate(dateA);
  const dB = parseDate(dateB);
  if (!dA || !dB) return false;
  return (
    dA.getFullYear() === dB.getFullYear() &&
    dA.getMonth() === dB.getMonth() &&
    dA.getDate() === dB.getDate()
  );
}

export function formatDayDividerLabel(dateString?: string): string {
  const date = parseDate(dateString);
  if (!date) return "";

  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

