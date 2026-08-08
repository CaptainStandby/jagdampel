import { test, expect } from "./fixtures";

test("CSP meta tag is present and blocks unsafe patterns", async ({ page }) => {
  await page.goto("/");

  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveCount(1);

  const content = await meta.getAttribute("content");
  expect(content).toBeTruthy();

  // Must NOT contain dangerous sources
  expect(content).not.toContain("unsafe-eval");

  // Must NOT contain directives ineffective in meta tags
  expect(content).not.toContain("frame-ancestors");
});
