import { describe, it, expect } from "vitest";
import { BUNDESLAENDER, stateName } from "./states";

describe("BUNDESLAENDER", () => {
  it("has all 16 Bundesländer", () =>
    expect(Object.keys(BUNDESLAENDER)).toHaveLength(16));
});

describe("stateName", () => {
  it("resolves a known code", () =>
    expect(stateName("SH")).toBe("Schleswig-Holstein"));

  it("is case-insensitive on the code", () =>
    expect(stateName("sh")).toBe("Schleswig-Holstein"));

  it("echoes an unknown code unchanged", () =>
    expect(stateName("ZZ")).toBe("ZZ"));
});
