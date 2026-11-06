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
const savedIds = async () =>
  (await call("/users/me/saved-posts")).posts.map((p) => p.id);
test("saving is idempotent, removable and ordered newest-saved first", async () => {
  resetDemo();
  getDemoState().currentUserId = 1;
  assert.deepEqual(await savedIds(), []);
  assert.equal((await call("/posts/2")).saved, false);
  assert.deepEqual(await call("/posts/2/save", "POST"), {
    post_id: 2,
    saved: true,
  });
  await call("/posts/3/save", "POST");
  await call("/posts/1/save", "POST");
  await call("/posts/3/save", "POST");
  assert.deepEqual(await savedIds(), [1, 3, 2]);
  assert.equal((await call("/posts/2")).saved, true);
  assert.equal(
    (await call("/posts")).find((p) => p.id === 2).saved,
    true,
    "feed responses carry the saved flag",
  );
  assert.deepEqual(await call("/posts/2/save", "DELETE"), {
    post_id: 2,
    saved: false,
  });
  await call("/posts/2/save", "DELETE");
  await call("/posts/9999/save", "DELETE");
  assert.deepEqual(await savedIds(), [1, 3]);
  // Re-saving after removal puts the post back on top.
  await call("/posts/2/save", "POST");
  assert.deepEqual(await savedIds(), [2, 1, 3]);
  await assert.rejects(call("/posts/abc/save", "POST"), /Invalid post id/);
  await assert.rejects(call("/posts/9999/save", "POST"), /not found/);
});
test("saved posts paginate without duplicates or gaps", async () => {
  resetDemo();
  const feed = (await call("/posts")).map((p) => p.id);
  const ids = feed.slice(0, 7);
  const extra = feed[7];
  for (const id of ids) await call(`/posts/${id}/save`, "POST");
  const seen = [];
  let path = "/users/me/saved-posts?limit=3";
  for (let pages = 0; pages < 10; pages++) {
    const page = await call(path);
    seen.push(...page.posts.map((p) => p.id));
    if (page.next_cursor === undefined) break;
    assert.equal(page.posts.length, 3);
    if (pages === 0) await call(`/posts/${extra}/save`, "POST");
    path = `/users/me/saved-posts?limit=3&cursor=${page.next_cursor}`;
  }
  assert.deepEqual(seen, [...ids].reverse());
  const exact = await call("/users/me/saved-posts?limit=8");
  assert.equal(exact.posts.length, 8);
  assert.equal(exact.next_cursor, undefined);
  await assert.rejects(call("/users/me/saved-posts?limit=0"), /Invalid limit/);
  await assert.rejects(
    call("/users/me/saved-posts?cursor=abc"),
    /Invalid cursor/,
  );
});
test("bookmarks are isolated per demo identity and survive a reload", async () => {
  resetDemo();
  getDemoState().currentUserId = 1;
  await call("/posts/2/save", "POST");
  getDemoState().currentUserId = 2;
  assert.deepEqual(await savedIds(), []);
  assert.equal((await call("/posts/2")).saved, false);
  await call("/posts/3/save", "POST");
  await call("/posts/2/save", "DELETE");
  assert.deepEqual(await savedIds(), [3]);
  getDemoState().currentUserId = 1;
  assert.deepEqual(await savedIds(), [2]);
  const restored = parseDemoStorage(storage.get(STORAGE_KEY));
  assert.deepEqual(
    restored.saved["1"].map((e) => e.post_id),
    [2],
  );
  assert.deepEqual(
    restored.saved["2"].map((e) => e.post_id),
    [3],
  );
  resetDemo();
  assert.deepEqual(getDemoState().saved, {});
  assert.deepEqual(await savedIds(), []);
});
test("older stored demo data without bookmarks still loads", () => {
  const legacy = createSeed();
  delete legacy.saved;
  const restored = parseDemoStorage(JSON.stringify(legacy));
  assert.deepEqual(restored.saved, {});
  assert.equal(restored.posts.length, legacy.posts.length);
  const malformed = createSeed();
  malformed.saved = { 1: [{ id: "x", post_id: 2 }] };
  assert.deepEqual(parseDemoStorage(JSON.stringify(malformed)).saved, {});
  const stranger = createSeed();
  stranger.saved = { 999: [{ id: 5, post_id: 2 }] };
  assert.deepEqual(parseDemoStorage(JSON.stringify(stranger)).saved, {});
});
test("saving respects audience rules and visibility is rechecked on read", async () => {
  resetDemo();
  getDemoState().currentUserId = 1;
  // Post 21 belongs to a private identity user 1 does not follow.
  await assert.rejects(call("/posts/21/save", "POST"), /not found/);
  assert.deepEqual(await savedIds(), []);
  // A post that becomes restricted drops out of the collection...
  const mine = new FormData();
  mine.set("title", "Soon private");
  mine.set("content", "Visible for now");
  mine.set("visibility", "public");
  const created = await demoRequest("/posts", { method: "POST", body: mine });
  getDemoState().currentUserId = 2;
  await call(`/posts/${created.id}/save`, "POST");
  assert.deepEqual(await savedIds(), [created.id]);
  getDemoState().currentUserId = 1;
  await call(`/posts/${created.id}`, "PUT", {
    title: "Soon private",
    content: "Now restricted",
    visibility: "followers",
    viewer_ids: [],
  });
  getDemoState().currentUserId = 2;
  getDemoState().follows = getDemoState().follows.filter(
    (f) => !(f[0] === 2 && f[1] === 1),
  );
  assert.deepEqual(await savedIds(), []);
  // ...but they can still clear a bookmark they can no longer see.
  await call(`/posts/${created.id}/save`, "DELETE");
  // Deleted posts disappear from every identity's collection.
  getDemoState().currentUserId = 1;
  await call("/posts/2/save", "POST");
  await call(`/posts/${created.id}`, "DELETE");
  assert.deepEqual(await savedIds(), [2]);
  for (const entries of Object.values(getDemoState().saved))
    assert.ok(entries.every((e) => e.post_id !== created.id));
});
test("group posts require current membership to stay saved", async () => {
  resetDemo();
  getDemoState().currentUserId = 1;
  const groupPost = getDemoState().posts.find((p) => p.group_id);
  const gid = groupPost.group_id;
  const outsider = getDemoState().users.find(
    (u) =>
      !getDemoState().memberships.some(
        (m) => m.groupId === gid && m.userId === u.id,
      ),
  ).id;
  getDemoState().currentUserId = outsider;
  await assert.rejects(call(`/posts/${groupPost.id}/save`, "POST"), /not found/);
  const member = getDemoState().memberships.find(
    (m) => m.groupId === gid && m.role !== "creator",
  );
  getDemoState().currentUserId = member.userId;
  await call(`/posts/${groupPost.id}/save`, "POST");
  assert.deepEqual(await savedIds(), [groupPost.id]);
  getDemoState().memberships = getDemoState().memberships.filter(
    (m) => !(m.groupId === gid && m.userId === member.userId),
  );
  assert.deepEqual(await savedIds(), []);
  // Deleting the whole community removes the bookmark rows too.
  getDemoState().memberships.push({
    groupId: gid,
    userId: member.userId,
    role: "member",
  });
  assert.deepEqual(await savedIds(), [groupPost.id]);
  const creator = getDemoState().groups.find((g) => g.id === gid).creator_id;
  getDemoState().currentUserId = creator;
  await call(`/groups/${gid}`, "DELETE");
  assert.deepEqual(getDemoState().saved[member.userId] ?? [], []);
});
test("saved store only reports server-confirmed state and dedupes requests", async () => {
  resetDemo();
  getDemoState().currentUserId = 1;
  const { setPostSaved, resetSavedPosts } =
    await import("../src/features/saved/savedPostsStore.ts");
  resetSavedPosts();
  const first = setPostSaved(2, true);
  // A second request for the same post while one is pending is ignored.
  assert.equal(await setPostSaved(2, true), null);
  assert.equal(await first, true);
  assert.deepEqual(await savedIds(), [2]);
  assert.equal(await setPostSaved(2, false), false);
  assert.deepEqual(await savedIds(), []);
  // Failures reject and do not leave the post stuck as pending.
  await assert.rejects(setPostSaved(9999, true), /not found/);
  assert.equal(await setPostSaved(3, true), true);
  resetSavedPosts();
});
