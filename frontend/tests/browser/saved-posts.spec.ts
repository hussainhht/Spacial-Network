import { test, expect, type Page } from "@playwright/test";
const base = "/Spacial-Network";
async function ready(page: Page, path = "/") {
  await page.goto(`${base}${path}`);
  await expect(
    page.getByRole("button", { name: "User account options" }),
  ).toBeVisible();
}
async function openSavedFromMenu(page: Page) {
  await page.getByRole("button", { name: "User account options" }).click();
  await page.getByRole("menuitem", { name: "Saved Posts" }).click();
  await expect(page).toHaveURL(/\/saved\/?$/);
}
// Switching identity reloads the page; wait for that so a following
// navigation can't race it.
async function switchTo(page: Page, id: string) {
  await page.getByRole("button", { name: "User account options" }).click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByLabel("Switch account").selectOption(id),
  ]);
  await expect(page.getByRole("button", { name: "User account options" })).toBeVisible();
}
const actions = (page: Page, index = 0) =>
  page.getByRole("article").nth(index).getByLabel("Post actions");
async function menuAction(page: Page, name: string, index = 0) {
  await actions(page, index).click();
  await page.getByRole("article").nth(index).getByRole("button", { name }).click();
}

test("save from the feed, find it under Saved Posts, keep it across reload and remove it", async ({
  page,
}) => {
  await ready(page);
  const title = await page
    .getByRole("article")
    .first()
    .getByRole("heading", { level: 2 })
    .innerText();
  await menuAction(page, "Save post");
  await expect(page.getByRole("status").filter({ hasText: "Saved to your collection." })).toBeVisible();
  await actions(page).click();
  await expect(
    page.getByRole("article").first().getByRole("button", { name: "Remove from saved" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // The detail page agrees with the feed.
  await page.getByRole("article").first().locator('a[href*="/posts/"]').first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await actions(page).click();
  await expect(page.getByRole("button", { name: "Remove from saved" })).toBeVisible();
  await page.keyboard.press("Escape");

  await openSavedFromMenu(page);
  await expect(page.getByRole("heading", { name: "Saved Posts", level: 2 })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").first()).toContainText(title);

  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);

  await menuAction(page, "Remove from saved");
  await expect(page.getByRole("heading", { name: "No saved posts yet" })).toBeVisible();
  await expect(page.getByText("Posts you save will appear here.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  await actions(page).click();
  await expect(page.getByRole("article").first().getByRole("button", { name: "Save post" })).toBeVisible();
});

test("saved collections are separate for each demo identity and Reset Demo clears them", async ({
  page,
}) => {
  await ready(page);
  await menuAction(page, "Save post");
  await expect(page.getByRole("status").filter({ hasText: "Saved to your collection." })).toBeVisible();

  await switchTo(page, "2");
  await ready(page, "/saved/");
  await expect(page.getByRole("heading", { name: "No saved posts yet" })).toBeVisible();

  await switchTo(page, "1");
  await ready(page, "/saved/");
  await expect(page.getByRole("article")).toHaveCount(1);

  await page.getByRole("button", { name: "User account options" }).click();
  await page.getByRole("button", { name: "Reset Demo" }).click();
  await page.getByRole("button", { name: "Restore sample data" }).click();
  await ready(page, "/saved/");
  await expect(page.getByRole("heading", { name: "No saved posts yet" })).toBeVisible();
});

test("saving works on mobile without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await menuAction(page, "Save post");
  await expect(page.getByRole("status").filter({ hasText: "Saved to your collection." })).toBeVisible();
  await openSavedFromMenu(page);
  await expect(page.getByRole("article")).toHaveCount(1);
  const overflow = await page.evaluate(() => {
    const pane = document.getElementById("page-content") ?? document.documentElement;
    return pane.scrollWidth - pane.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await actions(page).click();
  const item = page.getByRole("button", { name: "Remove from saved" });
  await expect(item).toBeVisible();
  const box = await item.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeGreaterThanOrEqual(36);
});
