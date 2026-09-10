/** Real app lifecycle/resilience checks. Read-only API traffic; no auth fixtures.
 * Run like browser-audit.mjs with PLAYWRIGHT_MODULE pointing to installed tooling.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { installUniverseProbe } from "./browser-probe.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const directory = process.env.UNIVERSE_AUDIT_DIR || "/tmp/universe-home-agent-4";
const baseURL = process.env.UNIVERSE_BASE_URL || "http://localhost:3000";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [], samples: [] };
const check = (name, passed, details) => report.checks.push({ name, passed, details });
const snapshot = (page) => page.evaluate(() => window.__universeAudit.snapshot());
const homeReady = async (page) => {
  await page.locator('[data-universe-scene="home"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('[aria-label="Focus Earth"]')?.disabled === false, null, { timeout: 45000 });
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(installUniverseProbe);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await homeReady(page);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    window.__originalCanvas = document.querySelector("canvas");
    window.__originalContext = window.__originalCanvas.getContext("webgl2");
  });
  report.initial = await snapshot(page);
  await page.getByRole("button", { name: "Focus Mars", exact: true }).click();
  await page.waitForTimeout(3500);
  report.mars = await snapshot(page);
  check("Mars focus centers Mars with Earth right and Saturn left", report.mars.active === "mars" && report.mars.objects.some((o) => o.name === "mars-ScrollRoot" && Math.abs(o.position[0]) < 0.02), report.mars.objects);
  const beforeSpin = await snapshot(page);
  await page.waitForTimeout(600);
  const afterSpin = await snapshot(page);
  check("Earth spin and Moon orbit advance independently", ["EarthRotationRoot", "MoonOrbitRoot"].every((name) => beforeSpin.objects.find((o) => o.name === name)?.rotation[1] !== afterSpin.objects.find((o) => o.name === name)?.rotation[1]));
  for (let round = 0; round < 5; round++) {
    await page.getByRole("link", { name: "Open Groups", exact: true }).click();
    await page.locator('[data-universe-scene="groups"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    const groups = await snapshot(page);
    check(`Round ${round + 1}: Groups canvas parked and sleeping`, groups.canvasCount === 1 && groups.pinSpacers === 0 && groups.render.length > 0 && groups.render.every((r) => r.frameloop === "never"), groups);
    await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Home", exact: true }).click();
    await homeReady(page);
    await page.waitForTimeout(2200);
    const home = await snapshot(page);
    const identity = await page.evaluate(() => document.querySelector("canvas") === window.__originalCanvas && document.querySelector("canvas").getContext("webgl2") === window.__originalContext);
    check(`Round ${round + 1}: Home restores Mars and canvas/context identity`, identity && home.active === "mars" && home.pinSpacers === 1 && home.canvasCount === 1, home);
    check(`Round ${round + 1}: selection cleared and input unlocked`, await page.locator('[data-universe-scene="home"]').getAttribute("data-selected-planet") === null && home.bodyOverflow === "" && !home.inert.includes("home"));
    report.samples.push(home);
  }
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.locator('[data-universe-scene="groups"]').waitFor();
  await page.goForward({ waitUntil: "domcontentloaded" });
  await homeReady(page);
  check("Back/Forward restores Home without input lock", (await snapshot(page)).bodyOverflow === "");
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Open Groups", exact: true }).click({ modifiers: ["Control"] });
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  check("Modified link leaves Home and selection unchanged", page.url() === `${baseURL}/` && await page.locator('[data-universe-scene="home"]').getAttribute("data-selected-planet") === null);
  await popup.close();
  await page.getByRole("button", { name: "User account options", exact: true }).click();
  check("Navbar menu remains above canvas", await page.getByRole("menu", { name: "User options" }).isVisible());
  await page.keyboard.press("Escape");
  check("Navbar menu restores focus", await page.getByRole("button", { name: "User account options", exact: true }).evaluate((button) => button === document.activeElement));
  await page.getByRole("button", { name: "Focus Earth", exact: true }).focus();
  const focus = await page.evaluate(() => ({ outline: getComputedStyle(document.activeElement).outlineStyle, width: getComputedStyle(document.activeElement).outlineWidth }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);
  check("Keyboard focus control and visible ring", (await snapshot(page)).active === "earth" && focus.outline !== "none" && focus.width !== "0px", focus);
  for (const progress of [0.24, 0.26, 0.74, 0.76]) {
    await page.evaluate((p) => {
      const pane = document.querySelector("#page-content");
      pane.scrollTop = (pane.scrollHeight - pane.clientHeight) * p;
    }, progress);
    await page.waitForTimeout(3500);
    const sample = await snapshot(page);
    check(`Nearest snap at ${progress}`, sample.active === (progress < 0.25 ? "earth" : progress < 0.75 ? "mars" : "saturn") && sample.objects.some((o) => o.name === `${sample.active}-ScrollRoot` && Math.abs(o.position[0]) < 0.03), sample);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  const reducedBefore = await snapshot(page);
  await page.waitForTimeout(500);
  const reducedAfter = await snapshot(page);
  check("Live reduced motion stops all rotations", ["EarthRotationRoot", "MoonOrbitRoot", "MoonRotationRoot", "mars-RotationRoot", "saturn-RotationRoot"].every((name) => reducedBefore.objects.some((o) => o.name === name) && JSON.stringify(reducedBefore.objects.find((o) => o.name === name)?.rotation) === JSON.stringify(reducedAfter.objects.find((o) => o.name === name)?.rotation)));
  await page.getByRole("button", { name: "Focus Mars", exact: true }).click();
  check("Reduced motion focus is immediate", (await snapshot(page)).active === "mars");
  await context.close();

  for (const failure of ["missing-mars", "no-webgl", "reduced-startup"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await context.addInitScript(installUniverseProbe);
    if (failure === "missing-mars") await context.route("**/models/planets/mars-final.glb", (route) => route.abort());
    if (failure === "no-webgl") await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
      };
    });
    const page = await context.newPage();
    const expectedErrors = [];
    page.on("pageerror", (error) => expectedErrors.push(error.message));
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.locator('[data-universe-scene="home"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(3500);
    const sample = await snapshot(page);
    check(`${failure}: DOM destinations survive`, await page.getByRole("navigation", { name: "Universe destinations" }).getByRole("link").count() === 3 && sample.bodyOverflow === "", { sample, expectedErrors });
    if (failure === "reduced-startup") {
      const before = await snapshot(page);
      await page.waitForTimeout(600);
      const after = await snapshot(page);
      check("Reduced startup demand rendering and stationary Earth", after.render.some((r) => r.frameloop === "demand") && before.objects.find((o) => o.name === "EarthRotationRoot")?.rotation[1] === after.objects.find((o) => o.name === "EarthRotationRoot")?.rotation[1]);
    }
    await page.screenshot({ path: `${directory}/${failure}.png` });
    await context.close();
  }
} catch (error) {
  report.blocker = String(error);
} finally {
  await browser.close();
  await writeFile(`${directory}/lifecycle-audit.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checks: report.checks.map(({ name, passed }) => ({ name, passed })), errors: report.errors, blocker: report.blocker }, null, 2));
