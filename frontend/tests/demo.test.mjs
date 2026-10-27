import { test } from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
process.env.NEXT_PUBLIC_BASE_PATH = "/Spacial-Network";
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  },
  dispatchEvent: () => {},
  location: { reload: () => {} },
};
const { demoRequest, sendDemoEvent, subscribeDemo } =
  await import("../src/demo/api.ts");
const { getDemoState, resetDemo, parseDemoStorage, STORAGE_KEY } =
  await import("../src/demo/store.ts");
const { createSeed } = await import("../src/demo/seed.ts");
const { postHref, groupHref } = await import("../src/demo/config.ts");
const call = (p, method = "GET", body) =>
  demoRequest(p, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
test("seed graph has valid deterministic references and local assets", () => {
  const s = createSeed();
  assert.equal(s.users.length, 16);
  assert.equal(s.posts.length, 32);
  assert.equal(s.comments.length, 64);
  assert.equal(s.groups.length, 8);
  assert.equal(s.events.length, 10);
  const users = new Set(s.users.map((u) => u.id)),
    posts = new Set(s.posts.map((p) => p.id)),
    groups = new Set(s.groups.map((g) => g.id));
  for (const c of s.comments) {
    assert.ok(posts.has(c.post_id));
    assert.ok(users.has(c.user_id));
  }
  for (const m of s.memberships) {
    assert.ok(users.has(m.userId));
    assert.ok(groups.has(m.groupId));
  }
  for (const e of s.events) assert.ok(groups.has(e.group_id));
  for (const p of s.posts.filter((p) => p.group_id))
    assert.ok(
      s.memberships.some(
        (m) => m.groupId === p.group_id && m.userId === p.user_id,
      ),
    );
  assert.equal(
    new Set(s.notifications.map((n) => n.id)).size,
    s.notifications.length,
  );
  for (const u of s.users)
    assert.ok(u.profile_photo.startsWith("/Spacial-Network/demo/"));
});
test("malformed stored data safely falls back to the complete seed", () => {
  assert.equal(parseDemoStorage("{broken").users.length, 16);
  assert.equal(parseDemoStorage('{"version":1,"users":[{}]}').users.length, 16);
  const broken = createSeed();
  broken.posts[0].user_id = 999;
  assert.equal(parseDemoStorage(JSON.stringify(broken)).posts[0].user_id, 1);
  const valid = createSeed();
  valid.currentUserId = 5;
  assert.equal(parseDemoStorage(JSON.stringify(valid)).currentUserId, 5);
});
test("feed filters, private profiles and audience rules", async () => {
  resetDemo();
  const all = await call("/posts"),
    following = await call("/posts?feed=following"),
    friends = await call("/posts?feed=friends");
  assert.ok(all.length > following.length);
  assert.ok(friends.length > 0);
  assert.ok(all.every((p) => p.user_id !== 5));
  assert.equal(
    (await call("/profiles/aria")).profile.can_view_full_profile,
    false,
  );
  await call("/profiles/aria/follow", "POST");
  assert.equal(
    (await call("/profiles/aria/follow-status")).has_pending_request,
    true,
  );
  getDemoState().currentUserId = 5;
  const requests = (await call("/follow-requests")).requests;
  const request = requests.find((r) => r.requester.id === 1);
  assert.ok(request);
  await call(`/follow-requests/${request.id}/accept`, "POST");
  getDemoState().currentUserId = 1;
  assert.equal(
    (await call("/profiles/aria")).profile.can_view_full_profile,
    true,
  );
  await call("/profiles/aria/follow", "DELETE");
  assert.equal(
    (await call("/profiles/aria")).profile.can_view_full_profile,
    false,
  );
  await assert.rejects(call("/posts/21"), /restricted/);
});
test("likes, comments and created post detail state persist consistently", async () => {
  resetDemo();
  const before = await call("/posts/2/likes");
  await call("/posts/2/likes", "POST");
  assert.equal((await call("/posts/2/likes")).count, before.count + 1);
  await call("/posts/2/likes", "DELETE");
  assert.equal((await call("/posts/2/likes")).count, before.count);
  const f = new FormData();
  f.set("content", "A local test comment");
  const c = await demoRequest("/posts/2/comments", { method: "POST", body: f });
  assert.ok((await call("/posts/2/comments")).some((x) => x.id === c.id));
  await call(`/comments/${c.id}`, "DELETE");
  assert.equal((await call("/posts/2/comments/count")).count, 2);
  const p = new FormData();
  p.set("title", "Local post");
  p.set("content", "A persisted story");
  p.set("visibility", "public");
  const created = await demoRequest("/posts", { method: "POST", body: p });
  assert.ok(created.id >= 1000);
  assert.match(postHref(created.id), /\/posts\/demo\/\?id=/);
  assert.equal(
    (await call(`/posts/${created.id}`)).content,
    "A persisted story",
  );
  assert.ok(
    JSON.parse(storage.get(STORAGE_KEY)).posts.some((p) => p.id === created.id),
  );
});
test("membership, requests, invitations, RSVP, and creator permissions", async () => {
  resetDemo();
  getDemoState().currentUserId = 4;
  await call("/groups/1/join-requests", "POST");
  assert.equal(
    (await call("/groups/1/membership")).has_pending_join_request,
    true,
  );
  await assert.rejects(call("/groups/1/events"), /Join this/);
  getDemoState().currentUserId = 1;
  const request = (await call("/groups/1/join-requests")).join_requests.find(
    (r) => r.user_id === 4,
  );
  await call(`/groups/1/join-requests/${request.id}/accept`, "POST");
  getDemoState().currentUserId = 4;
  assert.equal((await call("/groups/1/membership")).is_member, true);
  await call("/groups/1/events/1/response", "PUT", { response: "going" });
  assert.equal(
    (await call("/groups/1/events")).events[0].current_user_response,
    "going",
  );
  await call("/groups/1/events/1/response", "PUT", { response: "not_going" });
  assert.equal(
    (await call("/groups/1/events")).events[0].current_user_response,
    "not_going",
  );
  await assert.rejects(call("/groups/1", "DELETE"), /creator/);
  getDemoState().currentUserId = 1;
  const invitation = (await call("/group-invitations")).invitations[0];
  await call(`/group-invitations/${invitation.id}/accept`, "POST");
  assert.equal((await call("/groups/7/membership")).is_member, true);
  assert.match(groupHref(1001), /\/groups\/demo\/\?groupId=/);
});
test("local transport updates private and group messages and read state", async () => {
  resetDemo();
  const events = [];
  const unsubscribe = subscribeDemo((e) => events.push(e));
  sendDemoEvent("private_message", {
    recipient_id: 3,
    content: "Local transport test",
  });
  assert.ok(events.some((e) => e.type === "private_message"));
  assert.equal(
    (await call("/chat/history?user_id=3")).at(-1).content,
    "Local transport test",
  );
  assert.equal(
    (await call("/chat/conversations")).find((c) => c.partner_id === 3)
      .last_message,
    "Local transport test",
  );
  sendDemoEvent("group_message", { group_id: 1, content: "Local group test" });
  assert.equal(
    (await call("/groups/1/messages")).at(-1).content,
    "Local group test",
  );
  sendDemoEvent("mark_read", { sender_id: 3 });
  assert.equal(
    (await call("/chat/conversations")).find((c) => c.partner_id === 3)
      .unread_count,
    0,
  );
  unsubscribe();
});
test("notifications and search honor local state and privacy", async () => {
  resetDemo();
  const before = await call("/notifications/unread-count");
  assert.ok(before.count > 0);
  await call("/notifications/read-all", "PATCH");
  assert.equal((await call("/notifications/unread-count")).count, 0);
  const results = await call("/search?q=rover&type=all");
  assert.ok(results.posts.length > 0);
  assert.ok(
    (await call("/search?q=nonexistent-string-123")).posts.length === 0,
  );
  await assert.rejects(
    call("/users/me/password", "PATCH", {
      current_password: "x",
      new_password: "y",
    }),
    /no passwords/,
  );
  storage.set("unrelated:key", "keep");
  resetDemo();
  assert.equal(storage.get("unrelated:key"), "keep");
  assert.equal(getDemoState().currentUserId, 1);
});

test("selected audiences and private communities stay restricted in feeds and search", async () => {
  resetDemo();
  const form = new FormData();
  form.set("title", "Selected orbit only");
  form.set("content", "A limited audience example");
  form.set("visibility", "custom");
  form.append("viewer_ids", "3");
  const created = await demoRequest("/posts", { method: "POST", body: form });
  getDemoState().currentUserId = 3;
  assert.equal(
    (await call(`/posts/${created.id}`)).title,
    "Selected orbit only",
  );
  getDemoState().currentUserId = 4;
  await assert.rejects(call(`/posts/${created.id}`), /restricted/);
  assert.equal((await call("/search?q=Selected%20orbit")).posts.length, 0);
  const groups = (await call("/groups")).groups;
  assert.ok(groups.every((g) => g.privacy === "public"));
  await assert.rejects(call("/groups/7/messages"), /Join this/);
});

test("deleting a community cascades related local records without corrupting persistence", async () => {
  resetDemo();
  await call("/groups/1", "DELETE");
  const persisted = JSON.parse(storage.get(STORAGE_KEY));
  const restored = parseDemoStorage(JSON.stringify(persisted));
  assert.ok(!restored.groups.some((g) => g.id === 1));
  assert.ok(!restored.posts.some((p) => p.group_id === 1));
  assert.ok(!restored.groupMessages.some((m) => m.group_id === 1));
});
