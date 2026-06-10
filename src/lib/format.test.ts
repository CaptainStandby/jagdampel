import { describe, it, expect } from "vitest";
import { formatMonthDay, formatPeriod, seasonCalendarText } from "./format";
import type { Season } from "./seasons";

describe("formatMonthDay", () => {
  it("09-01 → 1. September", () =>
    expect(formatMonthDay("09-01")).toBe("1. September"));
  it("01-31 → 31. Januar", () =>
    expect(formatMonthDay("01-31")).toBe("31. Januar"));
});

describe("formatPeriod", () => {
  it("renders a span with an en-dash", () =>
    expect(formatPeriod({ start: "09-01", end: "01-31" })).toBe(
      "1. September – 31. Januar",
    ));
});

describe("seasonCalendarText", () => {
  it("year-round → ganzjährig", () =>
    expect(seasonCalendarText({ key: "x", type: "year-round" } as Season)).toBe(
      "ganzjährig",
    ));

  it("closed → keine Jagdzeit", () =>
    expect(seasonCalendarText({ key: "x", type: "closed" } as Season)).toBe(
      "keine Jagdzeit",
    ));

  it("range with no periods → nur mit Ausnahmegenehmigung", () =>
    expect(
      seasonCalendarText({ key: "x", type: "range", periods: [] } as Season),
    ).toBe("nur mit Ausnahmegenehmigung"));

  it("multiple periods joined with ·", () =>
    expect(
      seasonCalendarText({
        key: "x",
        type: "range",
        periods: [
          { start: "05-01", end: "05-31" },
          { start: "09-01", end: "01-31" },
        ],
      } as Season),
    ).toBe("1. Mai – 31. Mai · 1. September – 31. Januar"));
});
