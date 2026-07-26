import { test as base, expect } from "@playwright/test";

/** Fails the test if the page throws or logs a console error. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // ponytail: ignore resource 404s (no favicon is shipped) — not app errors
      if (m.text().startsWith("Failed to load resource")) return;
      errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await use(page);
    expect(
      errors,
      `Unexpected page/console errors:\n${errors.join("\n")}`,
    ).toEqual([]);
  },
});

export { expect };
