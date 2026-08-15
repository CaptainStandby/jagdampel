import { test, expect } from "./fixtures";

test("home page loads and the season matrix hydrates", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Jagdampel" }),
  ).toBeVisible();
  // The month selector only exists after the client:only SeasonMatrix hydrates.
  await expect(page.getByRole("group", { name: "Monat wählen" })).toBeVisible();
  // Ensure the skeleton successfully hides itself via the CSS :has() rule.
  await expect(page.locator(".cls-skeleton:visible")).toHaveCount(0);
});

test("a state page loads and the season list hydrates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Monat wählen" }).waitFor();
  await page.locator('a[href*="/state/"]').first().click();
  await expect(page).toHaveURL(/\/state\//);
  await expect(page.getByRole("region", { name: "Jagdzeiten" })).toBeVisible();
  await expect(page.locator(".cls-skeleton:visible")).toHaveCount(0);
});

test("a species page loads and the map hydrates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Monat wählen" }).waitFor();
  await page.locator('a[href*="/species/"]').first().click();
  await expect(page).toHaveURL(/\/species\//);
  const map = page.getByRole("region", { name: /^Karte:/ });
  await expect(map).toBeVisible();
  await expect(map.locator("svg")).toBeVisible();
  await expect(page.locator(".cls-skeleton:visible")).toHaveCount(0);
});

test("legal pages load", async ({ page }) => {
  await page.goto("/impressum");
  await expect(
    page.getByRole("heading", { level: 1, name: "Impressum" }),
  ).toBeVisible();

  await page.goto("/datenschutz");
  await expect(
    page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
  ).toBeVisible();
});

test("skeletons are hidden when JavaScript is disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/");
  // Skeleton should be hidden by the <noscript> inline style
  await expect(page.locator(".cls-skeleton:visible")).toHaveCount(0);
  // Fallback noscript content should be visible
  await expect(
    page.getByText(/Die Übersichtstabelle benötigt JavaScript/),
  ).toBeVisible();

  await context.close();
});
