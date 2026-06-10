import { describe, it, expect } from "vitest";
import {
  computeStatus,
  berlinDate,
  DEFAULT_LOOKAHEAD_DAYS,
  monthStatus,
} from "./status";
import type { Period, Season } from "./seasons";

const at = (iso: string) => new Date(iso);

const range = (periods: Period[], extra: Partial<Season> = {}): Season =>
  ({ key: "x", type: "range", periods, ...extra }) as Season;

describe("berlinDate (DST-aware)", () => {
  it("winter instant rolls past midnight (CET +1)", () =>
    expect(berlinDate(at("2026-01-01T23:30:00Z"))).toEqual({
      year: 2026,
      month: 1,
      day: 2,
    }));

  it("summer instant rolls past midnight (CEST +2)", () =>
    expect(berlinDate(at("2026-07-01T22:30:00Z"))).toEqual({
      year: 2026,
      month: 7,
      day: 2,
    }));
});

describe("computeStatus: year-round / closed", () => {
  it("year-round → open", () =>
    expect(
      computeStatus(
        { key: "x", type: "year-round" } as Season,
        at("2026-06-15T12:00:00Z"),
      ).kind,
    ).toBe("open"));

  it("closed → closed", () =>
    expect(
      computeStatus(
        { key: "x", type: "closed" } as Season,
        at("2026-06-15T12:00:00Z"),
      ).kind,
    ).toBe("closed"));

  it("year-round + conditional → conditional", () =>
    expect(
      computeStatus(
        {
          key: "x",
          type: "year-round",
          conditional: true,
          conditionNotes: "n",
        } as Season,
        at("2026-06-15T12:00:00Z"),
      ).kind,
    ).toBe("conditional"));
});

describe("computeStatus: range (simple span)", () => {
  it("open now, reports end", () =>
    expect(
      computeStatus(
        range([{ start: "09-01", end: "01-31" }]),
        at("2026-01-15T12:00:00Z"),
      ),
    ).toEqual({
      kind: "open",
      conditional: false,
      conditionNotes: null,
      activeEnd: "01-31",
    }));

  it("opens soon (16 days)", () =>
    expect(
      computeStatus(
        range([{ start: "07-01", end: "08-31" }]),
        at("2026-06-15T12:00:00Z"),
      ),
    ).toEqual({
      kind: "soon",
      conditional: false,
      conditionNotes: null,
      daysUntilOpen: 16,
      nextStart: "07-01",
    }));

  it("closed, next opening beyond lookahead", () =>
    expect(
      computeStatus(
        range([{ start: "10-01", end: "11-30" }]),
        at("2026-06-15T12:00:00Z"),
      ),
    ).toEqual({
      kind: "closed",
      conditional: false,
      conditionNotes: null,
      nextStart: "10-01",
    }));
});

describe("computeStatus: lookahead boundary (default 30)", () => {
  it("soon exactly at lookahead boundary (30 days, inclusive)", () =>
    expect(
      computeStatus(
        range([{ start: "07-01", end: "08-31" }]),
        at("2026-06-01T12:00:00Z"),
      ).kind,
    ).toBe("soon"));

  it("closed one day past lookahead (31 days)", () =>
    expect(
      computeStatus(
        range([{ start: "07-01", end: "08-31" }]),
        at("2026-05-31T12:00:00Z"),
      ).kind,
    ).toBe("closed"));
});

describe("computeStatus: wrap-around period", () => {
  it("open in January (07-01 → 02-28)", () =>
    expect(
      computeStatus(
        range([{ start: "07-01", end: "02-28" }]),
        at("2026-01-15T12:00:00Z"),
      ).kind,
    ).toBe("open"));

  it("in the spring gap → closed, reopens 07-01", () =>
    expect(
      computeStatus(
        range([{ start: "07-01", end: "02-28" }]),
        at("2026-04-15T12:00:00Z"),
      ),
    ).toEqual({
      kind: "closed",
      conditional: false,
      conditionNotes: null,
      nextStart: "07-01",
    }));
});

describe("computeStatus: disjoint periods", () => {
  it("open in the first window", () =>
    expect(
      computeStatus(
        range([
          { start: "05-01", end: "05-31" },
          { start: "09-01", end: "01-31" },
        ]),
        at("2026-05-15T12:00:00Z"),
      ).kind,
    ).toBe("open"));

  it("picks the nearest next start when between windows", () =>
    expect(
      computeStatus(
        range([
          { start: "05-01", end: "05-31" },
          { start: "09-01", end: "01-31" },
        ]),
        at("2026-07-15T12:00:00Z"),
      ).nextStart,
    ).toBe("09-01"));
});

describe("computeStatus: conditional ranges", () => {
  it("permit-only (conditional, no periods) → conditional regardless of date", () =>
    expect(
      computeStatus(
        range([], { conditional: true, conditionNotes: "nur mit Ausnahme" }),
        at("2026-06-15T12:00:00Z"),
      ).kind,
    ).toBe("conditional"));

  it("conditional open now → conditional, not plain open", () =>
    expect(
      computeStatus(
        range([{ start: "09-16", end: "10-31" }], {
          conditional: true,
          conditionNotes: "200 m Abstand",
        }),
        at("2026-10-01T12:00:00Z"),
      ).kind,
    ).toBe("conditional"));
});

describe("computeStatus: custom lookahead", () => {
  it("widens the soon window", () =>
    expect(
      computeStatus(
        range([{ start: "10-01", end: "11-30" }]),
        at("2026-06-15T12:00:00Z"),
        120,
      ).kind,
    ).toBe("soon"));

  it("DEFAULT_LOOKAHEAD_DAYS is 30", () =>
    expect(DEFAULT_LOOKAHEAD_DAYS).toBe(30));
});

describe("monthStatus (overview matrix)", () => {
  it("closed → closed", () =>
    expect(monthStatus({ key: "x", type: "closed" } as Season, 8)).toBe(
      "closed",
    ));

  it("year-round → open", () =>
    expect(monthStatus({ key: "x", type: "year-round" } as Season, 8)).toBe(
      "open",
    ));

  it("wrap 09-01→01-31 open in September", () =>
    expect(monthStatus(range([{ start: "09-01", end: "01-31" }]), 9)).toBe(
      "open",
    ));

  it("wrap 09-01→01-31 open in January", () =>
    expect(monthStatus(range([{ start: "09-01", end: "01-31" }]), 1)).toBe(
      "open",
    ));

  it("wrap 09-01→01-31 closed in June", () =>
    expect(monthStatus(range([{ start: "09-01", end: "01-31" }]), 6)).toBe(
      "closed",
    ));

  it("span fully inside May is open in May", () =>
    expect(monthStatus(range([{ start: "05-10", end: "05-20" }]), 5)).toBe(
      "open",
    ));

  it("span fully inside May is closed in April", () =>
    expect(monthStatus(range([{ start: "05-10", end: "05-20" }]), 4)).toBe(
      "closed",
    ));

  it("permit-only → conditional", () =>
    expect(
      monthStatus(range([], { conditional: true, conditionNotes: "x" }), 8),
    ).toBe("conditional"));

  it("conditional open in month → conditional", () =>
    expect(
      monthStatus(
        range([{ start: "09-16", end: "10-31" }], { conditional: true }),
        10,
      ),
    ).toBe("conditional"));
});
