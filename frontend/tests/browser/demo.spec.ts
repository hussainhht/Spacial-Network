import { test, expect, type Page } from "@playwright/test";
const base = "/Spacial-Network";
async function ready(page: Page, path = "/") {
  await page.goto(`${base}${path}`);
  if (/^\/groups\/[^/]+\/settings/.test(path)) {
    await expect(
      page.getByRole("region", { name: "Group Information" }),
    ).toBeVisible();
    return;
  }
  await expect(
    page.getByRole("button", { name: "User account options" }),
  ).toBeVisible();
}
async function switchUser(page: Page, id: string) {
  await page.getByRole("button", { name: "User account options" }).click();
  await page.getByLabel("Switch demo identity").selectOption(id);
  await expect(
    page.getByRole("button", { name: "User account options" }),
  ).toBeVisible();
}
test("populated feed, filters, likes, comments and reload persistence", async ({
  page,
}) => {
  await ready(page);
  await expect(page.getByRole("article").first()).toContainText(
    "A small network, a whole universe",
  );
  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await expect(page).toHaveURL(/feed=following/);
  await expect(page.getByRole("article").first()).toContainText("rover");
  await page.getByRole("tab", { name: "Friends", exact: true }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
  await ready(page, "/posts/2/");
  await page.getByRole("button", { name: "Like", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Write a comment" })
    .fill("A browser-tested local comment.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(
    page.getByText("A browser-tested local comment.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unlike", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A browser-tested local comment.", { exact: true }),
  ).toBeVisible();
});
test("public follow changes, private requests and switching identities", async ({
  page,
}) => {
  await ready(page, "/profile/orion/");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unfollow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
  await ready(page, "/profile/aria/");
  await expect(page.getByText(/This profile is private/i)).toBeVisible();
  await page
    .getByRole("button", { name: "Request Follow", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Requested", exact: true }),
  ).toBeVisible();
  await switchUser(page, "5");
  await expect(
    page.getByRole("button", { name: "User account options" }),
  ).toContainText("Aria");
  await ready(page, "/profile/");
  await expect(
    page.getByText("Aria Stone", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /Followers$/ }).click();
  const request = page
    .locator("li")
    .filter({ hasText: "@nova" })
    .filter({ has: page.getByRole("button", { name: "Accept", exact: true }) });
  await request.getByRole("button", { name: "Accept", exact: true }).click();
  await switchUser(page, "1");
  await ready(page, "/profile/aria/");
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Private orbit. Design sketches/)).toBeVisible();
});
test("create, edit and refresh a visitor-created post using static-safe links", async ({
  page,
}) => {
  await ready(page, "/posts/new/");
  await page
    .getByLabel("Title", { exact: true })
    .fill("A visitor-created orbit");
  await page
    .getByLabel("Content", { exact: true })
    .fill("This post exists only in this browser.");
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  const article = page
    .getByRole("article")
    .filter({ hasText: "A visitor-created orbit" });
  await expect(article).toBeVisible();
  await article
    .getByRole("link", { name: "A visitor-created orbit", exact: true })
    .click();
  await expect(page).toHaveURL(/\/posts\/demo\/\?id=/);
  await page.reload();
  await expect(
    page.getByText("This post exists only in this browser.", { exact: true }),
  ).toBeVisible();
  await page.locator("article details summary").click();
  await page.getByRole("link", { name: "Edit post", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/demo\/edit\/\?id=/);
  await page.getByLabel("Title", { exact: true }).fill("An edited orbit");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("An edited orbit", { exact: true }),
  ).toBeVisible();
});
test("group directory, member tabs, events, RSVP and local group chat", async ({
  page,
}) => {
  await ready(page, "/groups/");
  await expect(
    page.getByText("Orbital Observatory", { exact: true }).first(),
  ).toBeVisible();
  await ready(page, "/groups/1/");
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(
    page.getByText("Demo skywatch evening", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".group-response-btn")
    .filter({ hasText: /^✓ Going$/ })
    .first()
    .click();
  await page
    .locator(".group-response-btn")
    .filter({ hasText: /Not going/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Members", exact: true }).click();
  await expect(
    page.getByText("Nova Reed", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Group message text" })
    .fill("A local group conversation.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("A local group conversation.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(
    page.getByText("A local group conversation.", { exact: true }),
  ).toBeVisible();
});
test("private messages, notifications and local universal search", async ({
  page,
}) => {
  await ready(page, "/chat/?partnerId=3");
  await page
    .getByPlaceholder("Message mira...")
    .fill("A local private conversation.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("A local private conversation.", { exact: true }).last(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A local private conversation.", { exact: true }).last(),
  ).toBeVisible();
  await ready(page, "/notifications/");
  await page.getByRole("button", { name: /Mark all.*read/i }).click();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Open universal search/ }).click();
  await page.getByRole("combobox").fill("rover");
  await expect(
    page.getByText("The rover finally navigates on its own", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox").fill("unfindable-demo-query-928");
  await expect(page.getByText(/No results/).first()).toBeVisible();
});
test("all eight real planet models, Moon, theme tokens and persistent appearance", async ({
  page,
}) => {
  test.setTimeout(300000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const models = new Set<string>();
  page.on("response", (r) => {
    if (r.url().endsWith(".glb") && r.status() === 200)
      models.add(r.url().split("/").pop()!);
  });
  await ready(page, "/settings/");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  for (const name of [
    "Earth",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Sun",
  ]) {
    await page
      .getByRole("radio", { name: new RegExp(`^${name}`) })
      .check({ force: true });
    await expect(
      page.locator(`[data-planet-background="${name.toLowerCase()}"]`),
    ).toBeVisible();
    await expect
      .poll(() => models.has(`${name.toLowerCase()}-final.glb`))
      .toBe(true);
    await expect(page.locator("canvas")).toBeVisible();
    const expectedAccent: Record<string, string> = {
      Earth: "#69aef0",
      Mercury: "#b7c0ca",
      Venus: "#dfb46a",
      Mars: "#d8794e",
      Jupiter: "#c7a27c",
      Saturn: "#d8c188",
      Uranus: "#6fcfd3",
      Sun: "#e5a13c",
    };
    await expect
      .poll(() =>
        page
          .locator(`[data-planet="${name.toLowerCase()}"]`)
          .first()
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue("--planet-accent").trim(),
          ),
      )
      .toBe(expectedAccent[name]);
    await page.screenshot({
      path: `test-results/planet-${name.toLowerCase()}.png`,
    });
  }
  expect(models.has("moon-final.glb")).toBe(true);
  await page.reload();
  await expect(page.locator('[data-planet="sun"]').first()).toBeVisible();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Show 3D model/ })
    .uncheck({ force: true });
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("no backend, WebSockets, missing assets or browser errors on representative routes", async ({
  page,
}) => {
  const errors: string[] = [],
    bad: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("websocket", (ws) => sockets.push(ws.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.port === "8080" ||
      u.pathname.startsWith("/api/") ||
      u.origin !== "http://127.0.0.1:3000"
    )
      bad.push(r.url());
  });
  for (const path of [
    "/",
    "/profile/",
    "/profile/mira/",
    "/posts/2/",
    "/groups/",
    "/groups/1/",
    "/groups/1/settings/",
    "/chat/",
    "/notifications/",
    "/settings/",
  ])
    await ready(page, path);
  await expect(
    page.getByRole("tab", { name: "Appearance", exact: true }),
  ).toBeVisible();
  expect(sockets).toEqual([]);
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["laptop", 1280, 800],
  ["tablet", 820, 1180],
  ["mobile", 390, 844],
] as const) {
  test(`${name} layout and navigation have no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/demo-${name}.png` });
    await page
      .getByRole("link", { name: "Groups", exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/groups\/$/);
  });
}
test("demo reset retains unrelated preferences and malformed storage recovers", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    localStorage.setItem("unrelated:preference", "keep"),
  );
  await page.getByRole("button", { name: "User account options" }).click();
  await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore sample data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "User account options" }),
  ).toContainText("Nova");
  expect(
    await page.evaluate(() => localStorage.getItem("unrelated:preference")),
  ).toBe("keep");
  await page.evaluate(() =>
    localStorage.setItem("spacial-demo:v1", '{"version":1,"users":[{}]}'),
  );
  await page.reload();
  await expect(page.getByRole("article").first()).toContainText(
    "A small network, a whole universe",
  );
});
test("WebGL unavailable fallback keeps the application usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await ready(page);
  await expect(page.locator("[data-webgl-fallback]")).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("query detail routes explain missing IDs without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page, "/posts/demo/");
  await expect(
    page.getByText("Invalid post id", { exact: true }),
  ).toBeVisible();
  await ready(page, "/posts/demo/edit/");
  await expect(
    page.getByText("Invalid post id", { exact: true }),
  ).toBeVisible();
  await ready(page, "/groups/demo/");
  await expect(page.getByText(/Invalid group ID/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("creator reviews join requests and accepts an invitation", async ({
  page,
}) => {
  await ready(page, "/groups/1/#join-requests");
  const requests = page.locator("#join-requests");
  await expect(requests.getByText("@leo", { exact: true })).toBeVisible();
  await requests.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(requests.getByText("No pending join requests.")).toBeVisible();
  await page.getByRole("tab", { name: "Members", exact: true }).click();
  await expect(page.getByText("@leo", { exact: true })).toBeVisible();
  await ready(page, "/groups/");
  await page
    .locator("#invitations")
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await ready(page, "/groups/7/");
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toBeVisible();
});

test("create a community, open its static-safe URL and edit settings", async ({
  page,
}) => {
  await ready(page, "/groups/create/");
  await page.getByLabel("Group name", { exact: true }).fill("Visitor Makers");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A locally created community for curious builders.");
  await page.getByRole("button", { name: "Create Group", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(/\/groups\/demo\/\?groupId=/);
  await page.reload();
  await expect(
    page.getByText("Visitor Makers", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Group name", { exact: true })
    .fill("Visitor Makers Studio");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Visitor Makers Studio", { exact: true }).first(),
  ).toBeVisible();
});

test("profile edits, local avatar selection and post sharing", async ({
  page,
}) => {
  await ready(page, "/settings/");
  await page
    .getByLabel("About Me", { exact: true })
    .fill("Exploring the exhibition from this browser.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator("#profile-photo-upload").setInputFiles({
    name: "demo-avatar.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.getByRole("button", { name: "Save Photo", exact: true }).click();
  await expect(
    page.getByText("Profile photo updated.", { exact: true }),
  ).toBeVisible();
  await ready(page, "/profile/");
  await expect(
    page.getByText("Exploring the exhibition from this browser.", {
      exact: true,
    }),
  ).toBeVisible();
  await ready(page, "/posts/2/");
  await page.getByRole("button", { name: "Share post", exact: true }).click();
  await page
    .getByRole("button", { name: "Send to Mira Chen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sent to Mira Chen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close share dialog" }).click();
  await ready(page, "/chat/?partnerId=3");
  await expect(
    page.getByRole("link").filter({ hasText: "Tonight's observing notes" }),
  ).toBeVisible();
});

test("every seeded deep link and all nine GLB assets exist in the static artifact", async ({
  request,
}) => {
  const paths = [
    "/",
    "/chat/",
    "/groups/",
    "/groups/create/",
    "/posts/new/",
    "/profile/",
    "/notifications/",
    "/settings/",
    "/login/",
    "/register/",
  ];
  for (let id = 1; id <= 32; id++)
    paths.push(`/posts/${id}/`, `/posts/${id}/edit/`);
  for (let id = 1; id <= 8; id++)
    paths.push(`/groups/${id}/`, `/groups/${id}/settings/`);
  for (const username of [
    "nova",
    "orion",
    "mira",
    "leo",
    "aria",
    "ezra",
    "luna",
    "kai",
    "iris",
    "atlas",
    "sage",
    "finn",
    "lyra",
    "theo",
    "ada",
    "sol",
  ])
    paths.push(`/profile/${username}/`);
  paths.push(
    "/posts/demo/",
    "/posts/demo/edit/",
    "/groups/demo/",
    "/groups/demo/settings/",
  );
  for (const path of paths) {
    const response = await request.get(`${base}${path}`);
    expect(response.status(), path).toBe(200);
  }
  for (const name of [
    "earth",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "sun",
    "moon",
  ]) {
    const response = await request.get(
      `${base}/models/planets/${name}-final.glb`,
    );
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 4).toString()).toBe("glTF");
  }
  expect((await request.get(`${base}/.nojekyll`)).status()).toBe(200);
});

test("private follow suggestions show pending requests consistently across views", async ({
  page,
}) => {
  await ready(page);
  const suggestions = page.locator(
    'section[aria-labelledby="who-to-follow-title"]',
  );
  const aria = suggestions.getByRole("article").filter({ hasText: "@aria" });
  await aria.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    aria.getByRole("button", { name: "Requested", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    aria.getByRole("button", { name: "Requested", exact: true }),
  ).toBeDisabled();
  await ready(page, "/profile/aria/");
  await expect(
    page.getByRole("button", { name: "Requested", exact: true }),
  ).toBeDisabled();
});
