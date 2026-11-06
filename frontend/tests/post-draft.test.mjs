import { test } from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
const storage = new Map();
let broken = false;
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => { if (broken) throw new Error("quota"); storage.set(k, v); },
    removeItem: (k) => storage.delete(k),
  },
};
const d = await import("../src/features/posts/lib/postDraft.ts");
const vals = { title: "T", content: "C", visibility: "custom", viewerIds: [3, 4], hadImages: true };

test("keys are namespaced per mode and user", () => {
  assert.equal(d.draftStorageKey(7), "spacial-network:post-draft:v1:demo:7");
});
test("round trips title, content, visibility, viewers and image flag", () => {
  const k = d.draftStorageKey(1);
  assert.ok(d.writeDraft(k, 1, vals));
  const r = d.readDraft(k, 1);
  assert.deepEqual({ ...r, savedAt: 0 }, { ...vals, savedAt: 0 });
});
test("another user never reads the draft", () => {
  const k = d.draftStorageKey(1);
  d.writeDraft(k, 1, vals);
  assert.equal(d.readDraft(d.draftStorageKey(2), 2), null);
  storage.set(d.draftStorageKey(2), storage.get(k)); // copied under the wrong key
  assert.equal(d.readDraft(d.draftStorageKey(2), 2), null);
});
test("malformed or outdated data is rejected and cleared", () => {
  const k = d.draftStorageKey(5);
  for (const raw of ["{bad", "null", "[]", JSON.stringify({ version: 0 }),
    JSON.stringify({ version: 1, userId: 5, title: 1, content: "x", visibility: "public", viewerIds: [], savedAt: 1 }),
    JSON.stringify({ version: 1, userId: 5, title: "a", content: "x", visibility: "nope", viewerIds: [], savedAt: 1 })]) {
    storage.set(k, raw);
    assert.equal(d.readDraft(k, 5), null);
    assert.equal(storage.has(k), false);
  }
});
test("viewer ids are sanitized", () => {
  const r = d.parseDraft(JSON.stringify({ version: 1, userId: 1, title: "a", content: "b", visibility: "custom", viewerIds: [1, 1, "x", -2, 2.5, 9], savedAt: 1 }), 1);
  assert.deepEqual(r.viewerIds, [1, 9]);
});
test("empty posts are not drafts; storage failures are reported", () => {
  assert.ok(d.isEmptyDraft({ title: " ", content: "\n" }));
  broken = true;
  assert.equal(d.writeDraft("k", 1, vals), null);
  broken = false;
});
