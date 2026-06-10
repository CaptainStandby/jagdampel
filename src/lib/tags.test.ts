import { describe, it, expect } from "vitest";
import { TAGS, TAG_KEYS } from "./tags";

describe("TAG_KEYS", () => {
  it("is exactly the set of TAGS keys", () =>
    expect(TAG_KEYS).toEqual(new Set(TAGS.map((t) => t.key))));

  it("has one entry per tag", () => expect(TAG_KEYS.size).toBe(TAGS.length));

  it("includes the Hoch-/Niederwild partition keys", () => {
    expect(TAG_KEYS.has("schalenwild")).toBe(true);
    expect(TAG_KEYS.has("niederwild")).toBe(true);
  });
});
