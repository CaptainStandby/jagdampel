import { test, expect } from "./fixtures";

test("home page loads and the season matrix hydrates", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Jagdampel" }),
  ).toBeVisible();
  // The month selector only exists after the client:only SeasonMatrix hydrates.
  await expect(page.getByRole("group", { name: "Monat wählen" })).toBeVisible();
});
