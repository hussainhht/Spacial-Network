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
const orbitRoots = (snapshot) => Object.fromEntries(snapshot.objects.filter((o) => /-OrbitRoot$/.test(o.name)).map((o) => [o.name.replace("-OrbitRoot", ""), o]));
const focused = (snapshot, id) => {
  const roots = orbitRoots(snapshot);
  const subject = roots[id];
  // The focus slot is the front of the orbit: full scale on the z=0 framing
  // plane. The other two sit back on the ellipse at a fraction of the size.
  return Boolean(subject) && Math.abs(subject.scale[0] - 1) < 0.01 && Math.abs(subject.position[2]) < 0.01
    && Object.entries(roots).every(([key, o]) => key === id || (o.scale[0] < 0.6 && o.position[2] < -1));
};
  check("Mars focus brings Mars to the front of the orbit and sets the others back", report.mars.active === "mars" && focused(report.mars, "mars"), report.mars.objects);
  check("Both neighbours stay on screen while Mars is in focus", Object.values(orbitRoots(report.mars)).every((o) => o.scale[0] > 0.2), report.mars.objects);
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
    check(`Round ${round + 1}: Home restores Mars and canvas/context identity`, identity && home.active === "mars" && home.pinSpacers === 0 && home.canvasCount === 1, home);
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
  // Arrow keys must survive a destination button keeping focus.
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(1800);
  check("Arrow keys step the loop with a destination button focused", (await snapshot(page)).active === "mars");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1800);
  check("Arrow keys step back", (await snapshot(page)).active === "earth");
  // The loop is gesture-driven: there is no scroll extent to seek into, and the
  // pane must never gain one. A full turn in each direction has to land back on
  // the destination it started from, with no pin spacer and no page scroll.
  await page.getByRole("button", { name: "Focus Earth", exact: true }).click();
  await page.waitForTimeout(2000);
  for (const [direction, label] of [[1, "forward"], [-1, "backward"]]) {
    const order = ["earth", "mars", "saturn"];
    const seen = [];
    for (let step = 0; step < order.length; step += 1) {
      await page.mouse.move(700, 450);
      await page.mouse.wheel(0, 140 * direction);
      await page.waitForTimeout(1800);
      seen.push((await snapshot(page)).active);
    }
    const expected = order.map((_, i) => order[(((i + 1) * direction) % order.length + order.length) % order.length]);
    check(`A ${label} turn cycles ${expected.join(" -> ")} and returns to Earth`, JSON.stringify(seen) === JSON.stringify(expected), { seen, expected });
    const sample = await snapshot(page);
    check(`A ${label} turn leaves no scroll extent or pin spacer`, sample.pinSpacers === 0 && sample.scroll === 0, sample);
    check(`A ${label} turn leaves the focus at the front of the orbit`, focused(sample, sample.active), sample.objects);
  }
  const burstBefore = (await snapshot(page)).active;
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(4000);
  const burstAfter = await snapshot(page);
  const advanced = (["earth", "mars", "saturn"].indexOf(burstAfter.active) - ["earth", "mars", "saturn"].indexOf(burstBefore) + 3) % 3;
  // Momentum after one flick may fill the single queued slot; it must never run
  // away through the whole system, and the stage must stay coherent.
  check("A rapid burst advances at most two destinations and leaves one stage", advanced <= 2 && burstAfter.canvasCount === 1 && focused(burstAfter, burstAfter.active), { burstBefore, burstAfter: burstAfter.active, advanced });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  const reducedBefore = await snapshot(page);
  await page.waitForTimeout(500);
  const reducedAfter = await snapshot(page);
  check("Live reduced motion stops all rotations", ["EarthRotationRoot", "MoonOrbitRoot", "MoonRotationRoot", "mars-RotationRoot", "saturn-RotationRoot"].every((name) => reducedBefore.objects.some((o) => o.name === name) && JSON.stringify(reducedBefore.objects.find((o) => o.name === name)?.rotation) === JSON.stringify(reducedAfter.objects.find((o) => o.name === name)?.rotation)));
  await page.getByRole("button", { name: "Focus Mars", exact: true }).click();
  await page.waitForTimeout(600);
  check("Reduced motion focus settles almost immediately", (await snapshot(page)).active === "mars");
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
