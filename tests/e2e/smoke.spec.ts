import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("landing page renders the hero, feed and charts without console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-grid").getByRole("link").first()).toBeVisible();
  await expect(page.getByTestId("freshness")).toContainText("Synced from");
  await expect(page.getByTestId("change-feed")).toBeVisible();
  await expect(page.getByRole("img", { name: /Upgrade timeline/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Pipeline flow/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("explorer filters change the row count and the URL", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/eips");
  const count = page.getByTestId("explorer-count");
  await expect(count).toContainText(/^\d+ of \d+$/);
  const before = await count.textContent();
  await page.getByRole("button", { name: "Final", exact: false }).first().click();
  await expect(page).toHaveURL(/status=Final/);
  await expect(count).not.toHaveText(before!);
  await page.getByTestId("explorer-search").fill("blob");
  await expect(page).toHaveURL(/q=blob/);
  expect(errors).toEqual([]);
});

test("detail drawer opens from a row and closes with Escape", async ({ page }) => {
  await page.goto("/eips");
  await page.getByTestId("explorer-row").first().click();
  const drawer = page.getByTestId("eip-drawer");
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/eip=\d+/);
  await expect(drawer.getByRole("heading", { level: 2 })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page).not.toHaveURL(/eip=/);
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const initial = await page.evaluate(() => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const flipped = initial === "dark" ? "light" : "dark";
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", flipped);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", flipped);
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/", "/upgrades", "/tracks", "/eips", "/eips/7732"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("feeds are served", async ({ request }) => {
  const rss = await request.get("/feed.xml");
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain("<rss");
  const json = await (await request.get("/api/changes?limit=5")).json();
  expect(json.events.length).toBeLessThanOrEqual(5);
});

test("command palette jumps to an EIP", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByTestId("palette-input").fill("7732");
  await expect(page.getByRole("option").first()).toContainText("EIP-7732");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/eips\/7732$/);
});

test("watchlist: star an EIP, see it on the dashboard and filter the explorer", async ({ page }) => {
  await page.goto("/eips/7732");
  await page.getByRole("button", { name: "Watch EIP-7732" }).click();
  await page.goto("/");
  await expect(page.getByTestId("watchlist")).toContainText("EIP-7732");
  await page.goto("/eips?watched=1");
  await expect(page.getByTestId("explorer-count")).toHaveText(/^1 of /);
});

test("inclusion board shows all four stages", async ({ page }) => {
  await page.goto("/");
  const board = page.getByTestId("inclusion-board");
  for (const stage of ["Scheduled", "Considered", "Proposed", "Declined"]) {
    await expect(board.getByRole("heading", { name: stage })).toBeVisible();
  }
});
