import type { Season } from "./seasons";

/** One shaded stretch on the year bar, as percentages of the full width. */
export interface Segment {
  leftPct: number;
  widthPct: number;
  conditional: boolean;
}

// Days before the 1st of each month in a fixed non-leap year. We model the year
// as 365 days (matching the 02-28 convention) so the axis is stable.
const DAYS_BEFORE_MONTH = [
  0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
];
const YEAR_DAYS = 365;

/**
 * Position of a MM-DD date on the year axis, as a fraction 0..1. With
 * `inclusiveEnd`, returns the point *after* that day, so an end date covers its
 * whole box.
 */
export function dayFraction(mmdd: string, inclusiveEnd = false): number {
  const [month, day] = mmdd.split("-").map(Number);
  const dayOfYear =
    DAYS_BEFORE_MONTH[month - 1] + (day - 1) + (inclusiveEnd ? 1 : 0);
  return dayOfYear / YEAR_DAYS;
}

/**
 * The open stretches of a season as bar segments. A period wrapping the year end
 * (end < start) becomes two segments — one to Dec 31, one from Jan 1 — which is
 * how it reads on a Jan→Dec axis. Closed and permit-only seasons have none.
 */
export function seasonSegments(season: Season): Segment[] {
  const conditional = season.conditional === true;
  if (season.type === "closed") return [];
  if (season.type === "year-round") {
    return [{ leftPct: 0, widthPct: 100, conditional }];
  }

  const segments: Segment[] = [];
  for (const period of season.periods ?? []) {
    const start = dayFraction(period.start);
    const end = dayFraction(period.end, true);
    if (start < end) {
      segments.push({
        leftPct: start * 100,
        widthPct: (end - start) * 100,
        conditional,
      });
    } else {
      segments.push({
        leftPct: start * 100,
        widthPct: (1 - start) * 100,
        conditional,
      });
      segments.push({ leftPct: 0, widthPct: end * 100, conditional });
    }
  }
  return segments;
}

/** Where the "heute" marker sits on the year axis, as a fraction 0..1 (Berlin). */
export function todayFraction(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return (
    (DAYS_BEFORE_MONTH[value("month") - 1] + (value("day") - 1)) / YEAR_DAYS
  );
}
