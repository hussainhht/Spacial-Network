import { expect, test, type Locator, type Page } from "@playwright/test";
import { createSeed } from "../../src/demo/seed";

const base = "/Spacial-Network";
const longText = "First paragraph: stars & planets <3 — https://example.com/?a=1&b=2\n\nThird line\nFourth line\nFifth line\n" + "interstellar".repeat(45);

async function seed(page: Page) {
  const state = createSeed();
  state.posts[0].content = longText;
  state.posts[1].content = longText;
  state.posts[1].media[0].url = `${base}/image/templets/saturn.png`;
  state.posts[2].content = "Short & sweet <3";
  state.posts[3].content = "One\nTwo\nThree\nFour";
  state.posts[6].content = "One\nTwo\nThree\nFour\nFive";
  state.posts[5].content = "A sentence about stars. ".repeat(8);
  state.posts[24].content = longText;
  await page.addInitScript((data) => {
    localStorage.setItem("spacial-demo:v1", JSON.stringify(data));
  }, state);
}

async function fourLines(article: Locator) {
  const text = article.locator("p[id]");
  await expect.poll(() => text.evaluate((el) => {
    return el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight);
  })).toBeCloseTo(4, 1);
}

for (const width of [390, 820, 1440]) {
  test(`expandable posts respect rendered lines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seed(page);
    await page.goto(`${base}/`);
    const first = page.locator("#post-1");
    const second = page.locator("#post-2");
    await expect(first.getByRole("button", { name: "Show more" })).toBeVisible();
    await fourLines(first);
    await fourLines(page.locator("#post-4"));
    await expect(page.locator("#post-3").getByRole("button", { name: /Show/ })).toHaveCount(0);
    await expect(page.locator("#post-4").getByRole("button", { name: /Show/ })).toHaveCount(0);
    await expect(page.locator("#post-7").getByRole("button", { name: "Show more" })).toHaveCount(1);
    const more = first.getByRole("button", { name: "Show more" });
    const controlledId = await more.getAttribute("aria-controls");
    expect(controlledId).toBe(await first.locator("p[id]").getAttribute("id"));
    const url = page.url();
    await more.focus();
    const scrollBefore = await page.locator("#page-content").evaluate((el) => el.scrollTop);
    await more.press("Enter");
    const less = first.getByRole("button", { name: "Show less" });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    expect(await page.locator("#page-content").evaluate((el) => el.scrollTop)).toBe(scrollBefore);
    expect(await first.locator("p[id]").textContent()).toBe(longText);
    await expect(second.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
    await second.getByRole("button", { name: "Show more" }).click();
    await expect(less).toHaveAttribute("aria-expanded", "true");
    await less.focus();
    await less.press("Space");
    await fourLines(first);
    await expect(second.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await expect(second.locator("img").last()).toBeAttached();
    await expect(second.getByRole("button", { name: "Like", exact: true })).toBeAttached();
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("width changes recalculate overflow while preserving expansion", async ({ page }) => {
  await seed(page);
  await page.goto(`${base}/`);
  const article = page.locator("#post-6");
  await expect(article).toBeAttached();
  // Change the actual text width without changing the window size.
  await article.locator("p[id]").evaluate((el) => { el.style.width = "120px"; });
  await expect(article.getByRole("button", { name: "Show more" })).toBeAttached();
  await article.getByRole("button", { name: "Show more" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(article.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  await article.locator("p[id]").evaluate((el) => { el.style.width = "1000px"; });
  await expect(article.getByRole("button", { name: /Show/ })).toHaveCount(0);
});

for (const path of ["/profile/nova/", "/groups/1/", "/posts/1/"]) {
  test(`shared expandable text works on ${path}`, async ({ page }) => {
    await seed(page);
    await page.goto(`${base}${path}`);
    const article = page.locator(path === "/groups/1/" ? "#post-25" : "#post-1");
    await expect(article.getByRole("button", { name: "Show more" })).toBeAttached();
    await fourLines(article);
    await article.getByRole("button", { name: "Show more" }).click();
    await expect(article.getByRole("button", { name: "Show less" })).toBeVisible();
    expect(await article.locator("p[id]").textContent()).toBe(longText);
  });
}

test("composer preview remeasures dynamic content", async ({ page }) => {
  await page.goto(`${base}/posts/new/`);
  await page.getByLabel("Title", { exact: true }).fill("Live preview");
  const content = page.getByLabel("Content", { exact: true });
  await content.fill(longText);
  const preview = page.getByRole("article");
  await expect(preview.getByRole("button", { name: "Show more" })).toBeAttached();
  await content.fill("Now short.");
  await expect(preview.getByRole("button", { name: /Show/ })).toHaveCount(0);
  await content.fill("One\nTwo\nThree\nFour\nFive");
  await expect(preview.getByRole("button", { name: "Show more" })).toBeAttached();
  await fourLines(preview);
});

test("removing an earlier post keeps the remaining post expanded", async ({ page }) => {
  await seed(page);
  await page.goto(`${base}/`);
  const second = page.locator("#post-2");
  await second.getByRole("button", { name: "Show more" }).click();
  const first = page.locator("#post-1");
  await first.locator("summary").click();
  await first.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete post", exact: true }).click();
  await expect(first).toHaveCount(0);
  await expect(second.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
});

test("post text stays selectable above the card navigation link", async ({ page }) => {
  await seed(page);
  await page.goto(`${base}/`);
  const text = page.locator("#post-1 p[id]");
  await expect(text).toBeVisible();
  const url = page.url();
  await text.dblclick({ position: { x: 15, y: 10 } });
  expect(await page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
  expect(page.url()).toBe(url);
});
