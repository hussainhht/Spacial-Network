// Client-side iCalendar (RFC 5545) export for group events. No dependencies,
// no browser APIs at import time (safe for SSR); only downloadEventIcs touches the DOM.

export interface CalendarEventInput {
  id: number | string;
  title: string;
  description?: string | null;
  /** ISO 8601 timestamp with offset/Z, as returned by the API. */
  eventTime: string;
  /** Only exported when the event model provides a real location. */
  location?: string | null;
  /** Optional real end time. Never invented when absent. */
  endTime?: string | null;
}

const PRODID = "-//Spatial Network//Group Events//EN";
const UID_DOMAIN = "spatial-network";
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

/** YYYYMMDDTHHMMSSZ in UTC, or null for invalid dates. */
export function formatIcsUtc(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  if (d.getUTCFullYear() < 0 || d.getUTCFullYear() > 9999) return null;
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Escape a TEXT value. CR/LF/CRLF become \n, so input cannot start new properties. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    // Remaining control characters are not permitted in iCalendar text.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

/** Fold a content line at 75 octets without splitting UTF-8 characters. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_LINE_OCTETS - 1; // leading space counts toward the limit
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function eventUid(id: number | string): string {
  return `event-${id}@${UID_DOMAIN}`;
}

export type IcsResult = { ok: true; content: string } | { ok: false; reason: "invalid-date" };

export function buildEventIcs(event: CalendarEventInput, now: Date = new Date()): IcsResult {
  const start = formatIcsUtc(event.eventTime);
  const stamp = formatIcsUtc(now);
  if (!start || !stamp) return { ok: false, reason: "invalid-date" };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${eventUid(event.id)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
  ];

  // Only emit DTEND for a real, valid end strictly after the start.
  const end = formatIcsUtc(event.endTime);
  if (end && new Date(event.endTime as string).getTime() > new Date(event.eventTime).getTime()) {
    lines.push(`DTEND:${end}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title?.trim() || "Group event")}`);
  const description = event.description?.trim();
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  const location = event.location?.trim();
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return { ok: true, content: lines.map(foldIcsLine).join("\r\n") + "\r\n" };
}

export function icsFilename(event: Pick<CalendarEventInput, "id" | "title">): string {
  const slug = (event.title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || `spatial-event-${event.id}`}.ics`;
}

/** Browser-only. Returns false if the event could not be exported. */
export function downloadEventIcs(event: CalendarEventInput): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const result = buildEventIcs(event);
  if (!result.ok) return false;
  try {
    const blob = new Blob([result.content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFilename(event);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
