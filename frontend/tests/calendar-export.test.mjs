import { test } from "node:test";
import assert from "node:assert/strict";
const c = await import("../src/features/groups/lib/calendarExport.ts");

const NOW = new Date("2026-11-06T10:00:00Z");
const base = { id: 123, title: "Planet meetup", description: "Bring snacks", eventTime: "2027-01-10T15:00:00Z" };
const build = (e, n = NOW) => {
  const r = c.buildEventIcs(e, n);
  assert.ok(r.ok);
  return r.content;
};
// Independent minimal parser: unfold, split, check structure.
const parse = (ics) => {
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(!/(^|[^\r])\n/.test(ics), "bare LF found");
  const unfolded = ics.replace(/\r\n[ \t]/g, "");
  return unfolded.split("\r\n").filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return [l.slice(0, i), l.slice(i + 1)];
  });
};
const get = (props, k) => props.find(([n]) => n === k)?.[1];

test("valid event produces structured calendar", () => {
  const p = parse(build(base));
  assert.equal(p[0][0] + ":" + p[0][1], "BEGIN:VCALENDAR");
  assert.equal(get(p, "VERSION"), "2.0");
  assert.ok(get(p, "PRODID"));
  assert.equal(get(p, "SUMMARY"), "Planet meetup");
  assert.equal(get(p, "DESCRIPTION"), "Bring snacks");
  assert.equal(get(p, "DTSTAMP"), "20261106T100000Z");
  const last = p.at(-1);
  assert.equal(last[0] + ":" + last[1], "END:VCALENDAR");
  assert.equal(p.filter(([n]) => n === "BEGIN").length, 2);
});

test("UTC conversion respects offsets", () => {
  assert.equal(get(parse(build(base)), "DTSTART"), "20270110T150000Z");
  assert.equal(get(parse(build({ ...base, eventTime: "2027-01-10T18:00:00+03:00" })), "DTSTART"), "20270110T150000Z");
  assert.equal(get(parse(build({ ...base, eventTime: "2027-01-10T23:30:00-05:00" })), "DTSTART"), "20270111T043000Z");
});

test("UID is stable across exports", () => {
  const a = get(parse(build(base, new Date("2026-01-01T00:00:00Z"))), "UID");
  const b = get(parse(build(base, new Date("2026-06-01T00:00:00Z"))), "UID");
  assert.equal(a, b);
  assert.equal(a, "event-123@spatial-network");
});

test("escapes special characters and blocks property injection", () => {
  const ics = build({ ...base, title: "a, b; c\\d", description: "l1\nEND:VEVENT\r\nATTENDEE:evil\rx" });
  const p = parse(ics);
  assert.equal(get(p, "SUMMARY"), "a\\, b\\; c\\\\d");
  assert.equal(get(p, "ATTENDEE"), undefined);
  assert.equal(p.filter(([n]) => n === "END" ).length, 2);
  assert.equal(get(p, "DESCRIPTION"), "l1\\nEND:VEVENT\\nATTENDEE:evil\\nx");
});

test("Arabic text preserved and long lines fold on character boundaries", () => {
  const title = "فعالية المجموعة ".repeat(30);
  const ics = build({ ...base, title, description: "😀é".repeat(80) });
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const bytes = new TextEncoder().encode(ics);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const p = parse(decoded);
  assert.equal(get(p, "SUMMARY"), title.trim());
  assert.equal(get(p, "DESCRIPTION"), "😀é".repeat(80));
});

test("missing optional fields handled; no DTEND or LOCATION invented", () => {
  const p = parse(build({ id: 5, title: "T", description: "", eventTime: base.eventTime }));
  assert.equal(get(p, "DESCRIPTION"), undefined);
  assert.equal(get(p, "LOCATION"), undefined);
  assert.equal(get(p, "DTEND"), undefined);
  assert.equal(get(p, "DURATION"), undefined);
});

test("real end time used only when after start", () => {
  assert.equal(get(parse(build({ ...base, endTime: "2027-01-10T16:00:00Z" })), "DTEND"), "20270110T160000Z");
  assert.equal(get(parse(build({ ...base, endTime: "2027-01-10T14:00:00Z" })), "DTEND"), undefined);
  assert.equal(get(parse(build({ ...base, endTime: "junk" })), "DTEND"), undefined);
});

test("invalid dates do not produce a file", () => {
  for (const eventTime of ["", "nope", "2027-13-45"]) {
    assert.deepEqual(c.buildEventIcs({ ...base, eventTime }), { ok: false, reason: "invalid-date" });
  }
});

test("filenames are safe with fallback", () => {
  assert.equal(c.icsFilename({ id: 9, title: "Hello, World!/..\\x" }), "hello-world-x.ics");
  assert.equal(c.icsFilename({ id: 9, title: "فعالية" }), "spatial-event-9.ics");
  assert.equal(c.icsFilename({ id: 9, title: "" }), "spatial-event-9.ics");
});
