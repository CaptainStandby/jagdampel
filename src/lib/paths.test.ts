import { describe, it, expect } from "vitest";
import { href } from "./paths";

// No `base` is configured in astro.config (the site is served from the apex
// domain), so BASE_URL is "/". These cases double as proof that import.meta.env
// flows through getViteConfig into the test run.
describe("href", () => {
  it("empty path → root", () => expect(href()).toBe("/"));

  it("relative path is prefixed with the base", () =>
    expect(href("state/sh")).toBe("/state/sh"));

  it("a leading slash in the argument is normalized away", () =>
    expect(href("/species/schwarzwild")).toBe("/species/schwarzwild"));
});
