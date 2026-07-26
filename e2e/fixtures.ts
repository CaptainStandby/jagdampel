import { test as base, expect } from "@playwright/test";

/** Fails the test if the page throws or logs a console error. */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Stub the favicon so its absence never logs a console 404 (the site ships none).
    await page.route("**/favicon.ico", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
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
