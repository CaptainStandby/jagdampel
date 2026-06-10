import { describe, it, expect } from "vitest";
import { effectiveClassLabel } from "./seasons";
import type { Taxonomy } from "./seasons";

const taxonomy = {
  species: {
    reh: {
      label: "Rehwild",
      classes: { ricke: { label: "Ricken" }, kitz: { label: "Kitze" } },
    },
    schwarzwild: { label: "Schwarzwild", classes: {} },
  },
} as unknown as Taxonomy;

describe("effectiveClassLabel", () => {
  it("a state's regional term overrides the canonical class label", () =>
    expect(
      effectiveClassLabel(
        { key: "reh/ricke", type: "range", term: "Geißen" },
        taxonomy,
      ),
    ).toBe("Geißen"));

  it("uses the canonical taxonomy label when no term is given", () =>
    expect(
      effectiveClassLabel({ key: "reh/ricke", type: "range" }, taxonomy),
    ).toBe("Ricken"));

  it("whole-species seasons have no class label", () =>
    expect(
      effectiveClassLabel({ key: "schwarzwild", type: "range" }, taxonomy),
    ).toBe(null));

  it("unknown class key falls back to the raw key", () =>
    expect(
      effectiveClassLabel({ key: "reh/unbekannt", type: "range" }, taxonomy),
    ).toBe("unbekannt"));
});
