import { describe, it, expect } from "vitest";
import { matchesTags, matchesSearch, normalizeText } from "./filters";

const set = (...x: string[]) => new Set(x);

describe("matchesTags", () => {
  it("empty selection passes everything", () =>
    expect(matchesTags(["niederwild"], set())).toBe(true));

  it("single tag match (AND == OR for one)", () =>
    expect(matchesTags(["schalenwild", "neozoen"], set("schalenwild"))).toBe(
      true,
    ));

  it("single tag non-match", () =>
    expect(matchesTags(["federwild"], set("schalenwild"))).toBe(false));

  it("AND: both present", () =>
    expect(
      matchesTags(
        ["schalenwild", "hochwild", "neozoen"],
        set("schalenwild", "neozoen"),
      ),
    ).toBe(true));

  it("AND: one missing", () =>
    expect(matchesTags(["schalenwild"], set("schalenwild", "neozoen"))).toBe(
      false,
    ));

  it("AND: none present", () =>
    expect(
      matchesTags(["federwild", "wasserwild"], set("schalenwild", "neozoen")),
    ).toBe(false));
});

describe("matchesSearch", () => {
  it("empty query passes", () =>
    expect(matchesSearch("Graugänse", "")).toBe(true));

  it("substring: gans → Graugänse", () =>
    expect(matchesSearch("Graugänse", "gans")).toBe(true));

  it("diacritic-insensitive: loffel → Löffelente", () =>
    expect(matchesSearch("Löffelente", "loffel")).toBe(true));

  it("case-insensitive", () =>
    expect(matchesSearch("Wildschwein", "WILD")).toBe(true));

  it("non-match", () => expect(matchesSearch("Fuchs", "ente")).toBe(false));
});

describe("normalizeText", () => {
  it("folds ä + lowercases", () =>
    expect(normalizeText("Graugänse")).toBe("grauganse"));
});
