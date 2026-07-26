import { test, expect } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for the client:only SeasonMatrix to hydrate.
  await page.getByRole("group", { name: "Monat wählen" }).waitFor();
});

test("selecting a month updates the heading, the pressed state, and the URL", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Jun", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jagdzeiten im Juni" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jun", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]month=6(?:&|$)/);
});

test("searching narrows the species rows and clearing restores them", async ({
  page,
}) => {
  const rows = page.locator("table tbody tr");
  const total = await rows.count();
  expect(total).toBeGreaterThan(1);

  await page.getByRole("searchbox", { name: "Art suchen" }).fill("Reh");
  await expect(rows).not.toHaveCount(total);
  await expect(
    page.getByRole("link", { name: /Rehwild/ }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Suche löschen" }).click();
  await expect(rows).toHaveCount(total);
});

test("a non-matching search shows the empty state", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Art suchen" }).fill("zzzzzzzz");
  await expect(page.getByText("Keine Arten für diese Auswahl.")).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(0);
});
