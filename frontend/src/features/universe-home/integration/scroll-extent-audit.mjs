/** Agent 4 scroll-extent diagnosis: can the scroller actually reach progress 1?
 * Read-only. No login, API mocks or backend writes. Run against an existing app.
 * PLAYWRIGHT_MODULE=/abs/path/playwright/index.mjs node scroll-extent-audit.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installUniverseProbe } from "./browser-probe.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const directory = process.env.UNIVERSE_AUDIT_DIR || "/tmp/universe-home-agent-4";
const baseURL = process.env.UNIVERSE_BASE_URL || "http://localhost:3000";
await mkdir(directory, { recursive: true });

const measure = () => {
  const scroller = document.querySelector("#page-content");
  const spacer = document.querySelector(".pin-spacer");
  const home = document.querySelector('[data-universe-scene="home"]');
  const viewport = document.querySelector("[data-universe-viewport]");
  return {
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    clientHeight: scroller.clientHeight,
    maxScroll: scroller.scrollHeight - scroller.clientHeight,
    spacerHeight: spacer?.getBoundingClientRect().height ?? null,
    spacerStyleHeight: spacer?.style.height ?? null,
    homeHeight: home?.getBoundingClientRect().height ?? null,
    homeScrollHeight: home?.scrollHeight ?? null,
    viewportHeight: viewport?.getBoundingClientRect().height ?? null,
    paneHeightVar: home ? getComputedStyle(home).getPropertyValue("--universe-pane-height").trim() : null,
  };
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(installUniverseProbe);
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator('[data-universe-scene="home"]').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('[aria-label="Focus Earth"]')?.disabled, null, { timeout: 30000 });
    await page.waitForTimeout(1200);

    const entry = { width, height };
    results.push(entry);
    entry.atRest = await page.evaluate(measure);

    // Scroll to the true bottom of the pane and let scrub + snap settle.
    await page.evaluate(() => {
      const s = document.querySelector("#page-content");
      s.scrollTop = s.scrollHeight;
    });
    await page.waitForTimeout(3000);
    entry.atBottom = await page.evaluate(measure);
    entry.atBottomSnapshot = await page.evaluate(() => window.__universeAudit.snapshot());
    await page.screenshot({ path: path.join(directory, `extent-${width}-bottom.png`) });

    // Reverse: scroll back to the very top.
    await page.evaluate(() => { document.querySelector("#page-content").scrollTop = 0; });
    await page.waitForTimeout(3000);
    entry.atTopSnapshot = await page.evaluate(() => window.__universeAudit.snapshot());

    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(directory, "scroll-extent-audit.json"), JSON.stringify(results, null, 2));
}
for (const e of results) {
  const xs = (s) => Object.fromEntries(s.objects.filter((o) => o.name.includes("ScrollRoot")).map((o) => [o.name.split("-")[0], +o.position[0].toFixed(3)]));
  console.log(`\n=== ${e.width}x${e.height} ===`);
  console.log("at rest :", e.atRest);
  console.log("at bottom:", e.atBottom);
  console.log("bottom x :", xs(e.atBottomSnapshot), "active:", e.atBottomSnapshot.active);
  console.log("top x    :", xs(e.atTopSnapshot), "active:", e.atTopSnapshot.active);
}
