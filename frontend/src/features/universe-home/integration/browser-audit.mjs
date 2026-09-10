/** Read-only browser diagnostics. No login, API mocks, or backend writes.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser-audit.mjs
 * Artifacts default to /tmp/universe-home-agent-4/. Run against an existing app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installUniverseProbe } from "./browser-probe.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const directory = process.env.UNIVERSE_AUDIT_DIR || "/tmp/universe-home-agent-4";
const baseURL = process.env.UNIVERSE_BASE_URL || "http://localhost:3000";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(installUniverseProbe);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const entry = { width, height, errors, samples: [] };
    results.push(entry);
    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 45000 });
    try {
      await page.locator('[data-universe-scene="home"]').waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "Focus Earth", exact: true }).waitFor({ timeout: 15000 });
      await page.waitForFunction(() => !document.querySelector('[aria-label="Focus Earth"]')?.disabled, null, { timeout: 30000 });
      for (const planet of ["Earth", "Mars", "Saturn", "Mars", "Earth"]) {
        await page.getByRole("button", { name: `Focus ${planet}`, exact: true }).click();
        await page.waitForTimeout(2300);
        entry.samples.push(await page.evaluate(() => window.__universeAudit.snapshot()));
        if (["Earth", "Saturn"].includes(planet)) {
          await page.screenshot({ path: path.join(directory, `${width}-${planet.toLowerCase()}.png`) });
        }
      }
      await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
      await page.waitForTimeout(1500);
      entry.collapsed = await page.evaluate(() => window.__universeAudit.snapshot());
      await page.screenshot({ path: path.join(directory, `${width}-collapsed.png`) });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.getByRole("button", { name: "Focus Saturn", exact: true }).click();
      await page.waitForTimeout(700);
      entry.reducedStart = await page.evaluate(() => window.__universeAudit.snapshot());
      await page.waitForTimeout(700);
      entry.reducedEnd = await page.evaluate(() => window.__universeAudit.snapshot());
      entry.links = await page.getByRole("navigation", { name: "Universe destinations" }).locator("a").evaluateAll(
        (links) => links.map((link) => ({ text: link.textContent, href: link.getAttribute("href") })),
      );
    } catch (error) {
      entry.blocker = String(error);
      entry.last = await page.evaluate(() => window.__universeAudit.snapshot());
      await page.screenshot({ path: path.join(directory, `${width}-blocked.png`) });
    }
    await context.close();
    await writeFile(path.join(directory, "browser-audit.json"), JSON.stringify(results, null, 2));
  }
} finally {
  await browser.close();
  await writeFile(path.join(directory, "browser-audit.json"), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results.map(({ width, height, blocker, samples, errors }) => ({ width, height, blocker, samples: samples.length, errors })), null, 2));
