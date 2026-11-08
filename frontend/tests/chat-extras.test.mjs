import { test } from "node:test";
import assert from "node:assert/strict";
const g = await import("../src/features/chat-extras/lib/gif.ts");
const { insertAtCursor } = await import("../src/features/chat-extras/lib/insertAtCursor.ts");

const ok = "https://media.giphy.com/media/1in10D39NhoNq/giphy.gif";

test("trusted GIF urls are recognised, with surrounding whitespace", () => {
  assert.equal(g.parseGifMessage(`  ${ok}\n`), ok);
  assert.equal(g.gifThumbUrl(ok), "https://media.giphy.com/media/1in10D39NhoNq/200w.gif");
});
test("untrusted or unsafe urls and mixed text are not GIFs", () => {
  for (const bad of [
    "http://media.giphy.com/media/abcdefg/giphy.gif",
    "https://evil.com/media/abcdefg/giphy.gif",
    "https://media.giphy.com.evil.com/media/abcdefg/giphy.gif",
    "https://user@media.giphy.com/media/abcdefg/giphy.gif",
    "https://media.giphy.com/media/abcdefg/giphy.gif?x=1",
    "https://media.giphy.com/media/abcdefg/giphy.png",
    "javascript:alert(1)",
    `look ${ok}`,
    "",
  ]) assert.equal(g.parseGifMessage(bad), null, bad);
});
test("search filters the catalog and handles no results", () => {
  assert.ok(g.searchGifs("").length > 0);
  assert.ok(g.searchGifs("hello").every((x) => x.tags.includes("hello")));
  assert.equal(g.searchGifs("zzzzqqq").length, 0);
});
test("every catalog entry produces a trusted url", async () => {
  const { GIF_CATALOG } = await import("../src/features/chat-extras/lib/gifCatalog.ts");
  assert.ok(GIF_CATALOG.every((x) => g.isTrustedGifUrl(g.gifUrlFromId(x.id))));
});
test("insertAtCursor inserts at the caret, replaces selection and enforces the limit", () => {
  assert.deepEqual(insertAtCursor({ selectionStart: 2, selectionEnd: 2 }, "abcd", "😀", 10), { value: "ab😀cd", caret: 4 });
  assert.deepEqual(insertAtCursor({ selectionStart: 1, selectionEnd: 3 }, "مرحبا", "🙂", 10), { value: "م🙂با", caret: 3 });
  assert.equal(insertAtCursor({ selectionStart: 0, selectionEnd: 0 }, "abc", "😀", 4), null);
});
