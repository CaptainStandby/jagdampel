import { test, expect } from "./fixtures";

test("CSP meta tag is present with expected directives", async ({ page }) => {
  await page.goto("/");

  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveCount(1);

  const content = await meta.getAttribute("content");
  expect(content).toBeTruthy();

  // Core directives that must always be present
  expect(content).toContain("default-src 'self'");
  expect(content).toContain("script-src");
  expect(content).toContain("style-src");
  expect(content).toContain("object-src 'none'");
  expect(content).toContain("base-uri 'self'");

  // Must NOT contain unsafe-eval
  expect(content).not.toContain("unsafe-eval");

  // frame-ancestors must NOT be present (ineffective in meta tag)
  expect(content).not.toContain("frame-ancestors");
});
