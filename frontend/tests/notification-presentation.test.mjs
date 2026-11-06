import { test } from "node:test";
import assert from "node:assert/strict";
const p = await import("../src/features/notifications/utils/notificationPresentation.ts");

const TYPES = [
  "follow_request", "new_follower", "follow_accepted", "post_like", "post_comment",
  "group_invitation", "group_invitation_accepted", "group_invitation_declined",
  "group_join_request", "group_join_accepted", "group_join_rejected", "group_event",
  "event_rsvp", "private_message", "group_message",
];
const n = (id, type, createdAt, isRead = false) => ({
  id, type, createdAt, isRead, actorId: null, entityType: null, entityId: null, message: "", data: null,
});
const parse = (s) => new Date(s);

test("every supported type has a label, icon and category", () => {
  for (const t of TYPES) {
    assert.ok(p.TYPE_LABELS[t], t);
    assert.ok(p.TYPE_ICONS[t], t);
    assert.ok(["social", "groups", "messages"].includes(p.getNotificationCategory(t)), t);
  }
});

test("categories map to the expected types", () => {
  const list = TYPES.map((t, i) => n(i, t, "2026-11-06T10:00:00Z", i % 2 === 0));
  const ids = (f) => p.filterNotifications(list, f).map((x) => x.type);
  assert.deepEqual(ids("social"), TYPES.slice(0, 5));
  assert.deepEqual(ids("groups"), TYPES.slice(5, 13));
  assert.deepEqual(ids("messages"), ["private_message", "group_message"]);
  assert.equal(p.filterNotifications(list, "all"), list);
  assert.ok(p.filterNotifications(list, "unread").every((x) => !x.isRead));
});

test("groups by local day, in order, with one heading per day", () => {
  const now = new Date(2026, 10, 6, 15, 0);
  const at = (d, h) => new Date(2026, 10, d, h).toISOString();
  const list = [n(5, "post_like", at(6, 14)), n(4, "post_like", at(6, 1)),
    n(3, "post_like", at(5, 23)), n(2, "post_like", at(2, 9)), n(1, "post_like", at(2, 8))];
  const groups = p.groupNotificationsByDay(list, parse, now);
  assert.deepEqual(groups.map((g) => g.label.slice(0, 9)), ["Today", "Yesterday", groups[2].label.slice(0, 9)]);
  assert.notEqual(groups[2].label, "Today");
  assert.deepEqual(groups.map((g) => g.items.map((x) => x.id)), [[5, 4], [3], [2, 1]]);
});

test("older years include the year; unparseable dates fall into Earlier", () => {
  const now = new Date(2026, 10, 6);
  const [g] = p.groupNotificationsByDay([n(1, "post_like", new Date(2025, 0, 3).toISOString())], parse, now);
  assert.match(g.label, /2025/);
  const [u] = p.groupNotificationsByDay([n(2, "post_like", "bad")], () => null, now);
  assert.equal(u.label, "Earlier");
});
