import { test } from "node:test";
import assert from "node:assert/strict";
const { splitLinks } = await import("../src/features/posts/lib/linkify.ts");

const links = (s) => splitLinks(s).filter((x) => x.type === "link").map((x) => x.value);

test("plain text stays a single text segment", () => {
  assert.deepEqual(splitLinks("just words"), [{ type: "text", value: "just words" }]);
});
test("single https url becomes a link", () => {
  const [seg] = splitLinks("https://showroom.reboot01.com/spotlight");
  assert.equal(seg.type, "link");
  assert.equal(seg.href, "https://showroom.reboot01.com/spotlight");
});
test("multiple urls mixed with text keep surrounding text", () => {
  const segs = splitLinks("see http://a.com and https://b.org/x ok");
  assert.deepEqual(segs.map((s) => s.value), ["see ", "http://a.com", " and ", "https://b.org/x", " ok"]);
});
test("trailing punctuation is excluded", () => {
  for (const p of [".", ",", "!", "?", ")", ".)", "?!"]) {
    const text = p.includes(")") ? `(see https://a.com/x${p}` : `go https://a.com/x${p}`;
    assert.deepEqual(links(text), ["https://a.com/x"], p);
  }
});
test("balanced parentheses inside url are kept", () => {
  assert.deepEqual(links("https://en.wikipedia.org/wiki/Foo_(bar)."), ["https://en.wikipedia.org/wiki/Foo_(bar)"]);
});
test("multiline content preserves newlines", () => {
  const segs = splitLinks("line1\nhttps://a.com\n\nline3");
  assert.deepEqual(segs.map((s) => s.value), ["line1\n", "https://a.com", "\n\nline3"]);
});
test("long url is one link with full href", () => {
  const url = "https://a.com/" + "x".repeat(500);
  assert.deepEqual(links(url), [url]);
});
test("unsafe schemes stay plain text", () => {
  for (const t of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://a.com", "JAVASCRIPT:alert(1)"]) {
    assert.deepEqual(splitLinks(t), [{ type: "text", value: t }]);
  }
  assert.deepEqual(links("x javascript:alert(1) https://ok.com"), ["https://ok.com"]);
});
test("html-like text is not interpreted", () => {
  const segs = splitLinks('<a href="https://a.com">x</a>');
  assert.equal(segs.map((s) => s.value).join(""), '<a href="https://a.com">x</a>');
  assert.ok(segs.every((s) => s.type === "text" || s.href === "https://a.com/"));
});
test("invalid hostless url stays text", () => {
  assert.deepEqual(splitLinks("https://"), [{ type: "text", value: "https://" }]);
});
