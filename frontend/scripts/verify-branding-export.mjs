import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

// Run after `npm run build:demo`. Verify the artifact a static host will serve.
const root = resolve(process.argv[2] ?? "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network";
const site = `https://hussainhht.github.io${basePath}/`;
const image = `${site}branding/spatial-network-og.jpg`;
const titles = {
  "index.html": "Spatial Network",
  "profile/index.html": "Profile | Spatial Network",
  "groups/index.html": "Groups | Spatial Network",
  "notifications/index.html": "Notifications | Spatial Network",
  "settings/index.html": "Settings | Spatial Network",
};

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}

async function htmlFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) files.push(...await htmlFiles(path));
    else if (item.name.endsWith(".html")) files.push(path);
  }
  return files;
}

for (const [file, title] of Object.entries(titles)) {
  const html = await readFile(resolve(root, file), "utf8");
  assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], title, file);
}

const files = await htmlFiles(root);
for (const file of files) {
  const html = await readFile(file, "utf8");
  const tags = [...html.matchAll(/<meta\s[^>]*>/g)].map(([tag]) => attributes(tag));
  const meta = (key) => tags.find((tag) => tag.name === key || tag.property === key)?.content;
  assert.equal(meta("application-name"), "Spatial Network", file);
  assert.match(meta("description"), /Spatial Network.*fictional local data and no live backend\./, file);
  assert.equal(meta("og:description"), meta("description"), file);
  assert.equal(meta("twitter:description"), meta("description"), file);
  assert.equal(meta("og:title"), "Spatial Network", file);
  assert.equal(meta("og:site_name"), "Spatial Network", file);
  assert.equal(meta("og:type"), "website", file);
  assert.equal(new URL(meta("og:url")).href, site, file);
  assert.equal(meta("og:image"), image, file);
  assert.equal(meta("og:image:width"), "1200", file);
  assert.equal(meta("og:image:height"), "630", file);
  assert.ok(meta("og:image:alt")?.includes("Connect Beyond Boundaries"), file);
  assert.equal(meta("twitter:card"), "summary_large_image", file);
  assert.equal(meta("twitter:title"), "Spatial Network", file);
  assert.equal(meta("twitter:image"), image, file);

  const icons = [...html.matchAll(/<link\s[^>]*>/g)]
    .map(([tag]) => attributes(tag))
    .filter((tag) => ["icon", "shortcut icon", "apple-touch-icon"].includes(tag.rel));
  for (const name of ["favicon.ico", "icon.svg", "apple-icon.png"]) {
    assert.ok(icons.some((icon) => icon.href?.split("?")[0] === `${basePath}/${name}`), `${file}: missing ${name}`);
  }
  for (const icon of icons) {
    assert.ok(icon.href.startsWith(`${basePath}/`), `${file}: ${icon.href}`);
    const asset = icon.href.split("?")[0].slice(basePath.length + 1);
    assert.ok((await stat(resolve(root, asset))).size > 0, icon.href);
  }
}

const jpeg = await readFile(resolve(root, "branding/spatial-network-og.jpg"));
assert.equal(jpeg.readUInt16BE(0), 0xffd8, "Social image must be a real JPEG");
assert.ok(jpeg.length < 200_000, "Keep the sharing image below 200 KB");
const ico = await readFile(resolve(root, "favicon.ico"));
assert.equal(ico.readUInt16LE(2), 1, "ICO file type");
assert.equal(ico.readUInt16LE(4), 3, "Three favicon resolutions");
assert.deepEqual([0, 1, 2].map((i) => ico[6 + 16 * i]), [16, 32, 48]);
console.log(`Verified branding metadata and icon paths in ${files.length} exported HTML files; social image ${jpeg.length} bytes.`);
