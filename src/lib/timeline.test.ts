import { describe, it, expect } from "vitest";
import { seasonSegments, todayFraction, dayFraction } from "./timeline";
import type { Period, Season } from "./seasons";

const at = (iso: string) => new Date(iso);
const r2 = (n: number) => Math.round(n * 100) / 100;
const round = (segs: ReturnType<typeof seasonSegments>) =>
  segs.map((s) => ({
    leftPct: r2(s.leftPct),
    widthPct: r2(s.widthPct),
    conditional: s.conditional,
  }));

const range = (periods: Period[], extra: Partial<Season> = {}): Season =>
  ({ key: "x", type: "range", periods, ...extra }) as Season;

describe("dayFraction", () => {
  it("01-01 → 0", () => expect(dayFraction("01-01")).toBe(0));
  it("12-31 inclusive end → 1.0", () =>
    expect(dayFraction("12-31", true)).toBe(1));
});

describe("seasonSegments", () => {
  it("closed → no segments", () =>
    expect(seasonSegments({ key: "x", type: "closed" } as Season)).toEqual([]));

  it("year-round → full bar", () =>
    expect(seasonSegments({ key: "x", type: "year-round" } as Season)).toEqual([
      { leftPct: 0, widthPct: 100, conditional: false },
    ]));

  it("simple span 05-01 → 05-31", () =>
    expect(
      round(seasonSegments(range([{ start: "05-01", end: "05-31" }]))),
    ).toEqual([{ leftPct: 32.88, widthPct: 8.49, conditional: false }]));

  it("wrap span 09-01 → 01-31 splits across year end", () =>
    expect(
      round(seasonSegments(range([{ start: "09-01", end: "01-31" }]))),
    ).toEqual([
      { leftPct: 66.58, widthPct: 33.42, conditional: false },
      { leftPct: 0, widthPct: 8.49, conditional: false },
    ]));

  it("disjoint periods → concatenated segments", () =>
    expect(
      round(
        seasonSegments(
          range([
            { start: "05-01", end: "05-31" },
            { start: "09-01", end: "01-31" },
          ]),
        ),
      ),
    ).toEqual([
      { leftPct: 32.88, widthPct: 8.49, conditional: false },
      { leftPct: 66.58, widthPct: 33.42, conditional: false },
      { leftPct: 0, widthPct: 8.49, conditional: false },
    ]));

  it("conditional flag propagates to segments", () =>
    expect(
      seasonSegments(
        range([{ start: "09-16", end: "10-31" }], { conditional: true }),
      ).every((s) => s.conditional === true),
    ).toBe(true));

  it("permit-only (conditional, no periods) → no segments", () =>
    expect(
      seasonSegments(range([], { conditional: true, conditionNotes: "x" })),
    ).toEqual([]));
});

describe("todayFraction", () => {
  // 5 June → day-of-year 155 / 365
  it("today fraction (5 June)", () =>
    expect(r2(todayFraction(at("2026-06-05T12:00:00Z")) * 100)).toBe(42.47));
});
