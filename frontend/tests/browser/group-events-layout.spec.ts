import { test, expect, type Page } from "@playwright/test";

const base = "/Spacial-Network";
const shotDir = process.env.EVENT_SHOT_DIR;

async function openEvents(page: Page) {
  await page.goto(`${base}/groups/`);
  await expect(page.getByRole("button", { name: "User account options" })).toBeVisible();
  await page.goto(`${base}/groups/1/`);
  await expect(page.getByRole("button", { name: "User account options" })).toBeVisible();
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(page.locator(".group-event-card").first()).toBeVisible();
}

for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`event cards do not overlap or overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openEvents(page);
    const result = await page.evaluate(() => {
      const issues: string[] = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) issues.push("page horizontal overflow");
      document.querySelectorAll<HTMLElement>(".group-event-card").forEach((card, i) => {
        const cr = card.getBoundingClientRect();
        const parts = [".group-event-date-block", ".group-event-cover", ".group-event-details", ".group-event-rsvp"]
          .map((sel) => card.querySelector<HTMLElement>(sel))
          .filter((el): el is HTMLElement => !!el);
        parts.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > cr.right + 1 || r.left < cr.left - 1) issues.push(`card ${i}: ${el.className} outside card`);
        });
        for (let a = 0; a < parts.length; a++)
          for (let b = a + 1; b < parts.length; b++) {
            const x = parts[a].getBoundingClientRect();
            const y = parts[b].getBoundingClientRect();
            const overlap = x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1;
            if (overlap) issues.push(`card ${i}: ${parts[a].className} overlaps ${parts[b].className}`);
          }
        card.querySelectorAll<HTMLElement>("*").forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible" && el.clientWidth > 0 && !el.closest("svg"))
            issues.push(`card ${i}: ${el.tagName}.${el.className} content overflows`);
        });
      });
      return issues;
    });
    expect(result).toEqual([]);
    if (shotDir) await page.screenshot({ path: `${shotDir}/events-${width}.png`, fullPage: false });
  });
}

test("create event modal: open, protect unsaved input, validate, create", async ({ page }) => {
  await openEvents(page);
  await expect(page.locator(".group-create-event-panel")).toHaveCount(0);
  const trigger = page.getByRole("button", { name: /Create event/ }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create event" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/Title/)).toBeFocused();
  if (shotDir) await page.screenshot({ path: `${shotDir}/modal-1440.png` });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("button", { name: "Create event", exact: true }).click();
  await expect(dialog.getByText("Enter an event title.")).toBeVisible();

  await dialog.getByLabel(/Title/).fill("Layout regression night");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("alertdialog")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(dialog).toBeVisible();

  const future = new Date(Date.now() + 3 * 86400000);
  const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel(/Date/).fill(date);
  await dialog.getByLabel(/Time/).fill("19:30");
  await dialog.getByRole("button", { name: "Create event", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Layout regression night", { exact: true })).toBeVisible();
});

test("create event modal fits a phone screen and scrolls internally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openEvents(page);
  await page.getByRole("button", { name: /Create event/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create event" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(700);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Create event", exact: true })).toBeInViewport();
  if (shotDir) await page.screenshot({ path: `${shotDir}/modal-390.png` });
});
