import { expect, test, type Page } from "@playwright/test";

const POSTS = 'article[id^="post-"]';

async function feedState(page: Page) {
  return page.evaluate((selector) => {
    const pane = document.getElementById("page-content")!;
    const top = pane.getBoundingClientRect().top;
    let anchor: { id: string; offset: number } | null = null;
    const ids: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      ids.push(el.id);
      const r = el.getBoundingClientRect();
      if (!anchor && r.bottom > top) anchor = { id: el.id, offset: Math.round(r.top - top) };
    }
    return { path: location.pathname + location.search, scrollTop: Math.round(pane.scrollTop), ids, anchor };
  }, POSTS);
}

/** Real wheel scrolling over the real #page-content pane until enough posts have loaded. */
async function scrollThroughFeed(page: Page, minPosts = 20) {
  const box = (await page.locator("#page-content").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(250);
    if ((await page.locator(POSTS).count()) >= minPosts && i > 6) break;
  }
  // Let load-more settle, then make sure the position is stable.
  await expect.poll(async () => {
    const a = await page.locator(POSTS).count();
    await page.waitForTimeout(700);
    return a === (await page.locator(POSTS).count());
  }).toBe(true);
}

/** Click a point of a fully visible card where `hrefPart` link is the topmost element. */
async function clickVisibleCardLink(page: Page, hrefPart: string) {
  const target = await page.evaluate(([selector, part]) => {
    const pane = document.getElementById("page-content")!.getBoundingClientRect();
    for (const card of document.querySelectorAll<HTMLElement>(selector)) {
      const r = card.getBoundingClientRect();
      if (r.top < pane.top + 60 || r.bottom > pane.bottom - 20) continue;
      for (let fy = 0.05; fy < 0.95; fy += 0.05) {
        for (let fx = 0.03; fx < 0.97; fx += 0.04) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          const hit = document.elementFromPoint(x, y)?.closest("a");
          if (hit?.getAttribute("href")?.includes(part)) return { x, y };
        }
      }
    }
    return null;
  }, [POSTS, hrefPart] as const);
  expect(target, `visible ${hrefPart} link`).not.toBeNull();
  await page.mouse.click(target!.x, target!.y);
}

async function expectRestored(page: Page, before: Awaited<ReturnType<typeof feedState>>) {
  await expect(page.locator(POSTS).first()).toBeVisible();
  await expect.poll(async () => (await feedState(page)).anchor?.id).toBe(before.anchor!.id);
  const after = await feedState(page);
  expect(after.ids).toEqual(before.ids);
  expect(new Set(after.ids).size).toBe(after.ids.length);
  expect(Math.abs(after.anchor!.offset - before.anchor!.offset)).toBeLessThan(8);
  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(16);
}

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 800 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      // Slow images so layout keeps shifting after the feed is restored.
      await page.route(/\.(png|jpe?g|webp)(\?.*)?$/, async (route) => {
        await new Promise((r) => setTimeout(r, 600));
        await route.continue();
      });
      await page.goto("./");
      await expect(page.locator(POSTS).first()).toBeVisible();
      await scrollThroughFeed(page);
    });

    test("browser Back from a post restores loaded posts and position", async ({ page }) => {
      const before = await feedState(page);
      expect(before.ids.length).toBeGreaterThanOrEqual(20);
      expect(before.scrollTop).toBeGreaterThan(1000);
      await clickVisibleCardLink(page, "/posts/");
      await expect(page).toHaveURL(/posts/);
      await page.waitForTimeout(1500);
      await page.goBack();
      await expectRestored(page, before);

      // Forward then Back again behaves the same.
      await page.goForward();
      await expect(page).toHaveURL(/posts/);
      await page.goBack();
      await expectRestored(page, before);
    });

    test('the in-app "Back to home" link resumes the feed', async ({ page }) => {
      const before = await feedState(page);
      await clickVisibleCardLink(page, "/posts/");
      await expect(page).toHaveURL(/posts/);
      await page.getByRole("link", { name: /Back to home/ }).click();
      await expectRestored(page, before);
    });

    test("browser Back from an author profile restores the feed", async ({ page }) => {
      const before = await feedState(page);
      await clickVisibleCardLink(page, "/profile/");
      await expect(page).toHaveURL(/profile/);
      await page.waitForTimeout(1000);
      await page.goBack();
      await expectRestored(page, before);
    });

    test("fresh Home navigation starts at the top", async ({ page }) => {
      await page.goto("./groups/");
      await expect(page).toHaveURL(/groups/);
      await page.getByRole("link", { name: "Home", exact: true }).first().dispatchEvent("click");
      await expect(page.locator(POSTS).first()).toBeVisible();
      await page.waitForTimeout(800);
      const state = await feedState(page);
      expect(state.scrollTop).toBeLessThan(5);
      expect(state.ids.length).toBeLessThanOrEqual(21);
    });
  });
}

test("feed filters keep separate positions and posts", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(POSTS).first()).toBeVisible();
  await scrollThroughFeed(page, 20);
  const all = await feedState(page);

  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await expect(page).toHaveURL(/feed=following/);
  await expect(page.locator(POSTS).first()).toBeVisible();
  await page.waitForTimeout(600);
  const following = await feedState(page);
  // Existing behaviour: a filter change keeps the pane offset, clamped to the shorter list.
  expect(following.scrollTop).toBeLessThan(all.scrollTop);
  expect(following.ids.length).toBeLessThan(all.ids.length);
  expect(following.ids).not.toEqual(all.ids);

  await page.goBack();
  await expect(page).not.toHaveURL(/feed=following/);
  await expectRestored(page, all);
});
