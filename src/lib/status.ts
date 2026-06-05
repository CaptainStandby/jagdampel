import type { Period, Season } from "./seasons";

/**
 * The four states the traffic-light UI distinguishes:
 * - `open`        — huntable now (🟢)
 * - `conditional` — huntable now but only under restrictions/permit, OR permit-only
 *                   with no calendar at all. Never a plain 🟢 — the user must see the catch.
 * - `soon`        — not open now, but the next period starts within the lookahead window (🟡)
 * - `closed`      — Schonzeit; not open and not opening soon (🔴)
 */
export type StatusKind = "open" | "conditional" | "soon" | "closed";

export interface SeasonStatus {
  kind: StatusKind;
  /** Whether the underlying season carries any legal restriction (permit/Maßgabe). */
  conditional: boolean;
  /** For `soon`: whole days from today until the next period opens. */
  daysUntilOpen?: number;
  /** MM-DD of the next opening (set for `soon`, and for `closed` if it reopens later). */
  nextStart?: string;
  /** MM-DD on which the currently-active period ends (set for `open`/`conditional`-open). */
  activeEnd?: string;
  /** The restriction wording, when conditional. */
  conditionNotes?: string | null;
}

/** Default "opens soon" horizon, in days (DESIGN_SPEC §5). */
export const DEFAULT_LOOKAHEAD_DAYS = 30;

const MS_PER_DAY = 86_400_000;

interface YMD {
  year: number;
  month: number;
  day: number;
}

/**
 * The calendar date in Europe/Berlin for the given instant, regardless of where
 * the visitor's device is. Seasons are German law, so "today" is always Berlin's
 * today — a hunter checking from abroad still gets the right answer.
 */
export function berlinDate(now: Date): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
  };
}

const toMMDD = (ymd: YMD): string =>
  `${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;

/**
 * Whether a MM-DD date falls inside a period. A period wraps the year boundary
 * when its end is calendar-earlier than its start (e.g. 07-01 → 02-28), so the
 * test flips from "between" to "outside the gap". Zero-padded MM-DD compares
 * correctly as strings.
 */
function inPeriod(period: Period, today: string): boolean {
  if (period.start <= period.end) {
    return today >= period.start && today <= period.end;
  }
  return today >= period.start || today <= period.end;
}

/** Whole days from `today` to the next occurrence of a MM-DD start. */
function daysUntilStart(today: YMD, startMMDD: string): number {
  const [month, day] = startMMDD.split("-").map(Number);
  const todayUTC = Date.UTC(today.year, today.month - 1, today.day);
  let targetUTC = Date.UTC(today.year, month - 1, day);
  if (targetUTC < todayUTC) {
    targetUTC = Date.UTC(today.year + 1, month - 1, day);
  }
  return Math.round((targetUTC - todayUTC) / MS_PER_DAY);
}

/**
 * Resolve a season to its current traffic-light state for the given instant.
 * Pure and timezone-correct: pass `new Date()` on the client so the light always
 * reflects the real today, never a stale build time.
 */
export function computeStatus(
  season: Season,
  now: Date,
  lookaheadDays: number = DEFAULT_LOOKAHEAD_DAYS,
): SeasonStatus {
  const conditional = season.conditional === true;
  const conditionNotes = season.conditionNotes ?? null;
  const base = { conditional, conditionNotes };

  if (season.type === "closed") {
    return { kind: "closed", ...base };
  }
  if (season.type === "year-round") {
    return { kind: conditional ? "conditional" : "open", ...base };
  }

  const periods = season.periods ?? [];

  // Permit-only: a conditional season with no calendar is never plainly open and
  // never "soon" — it is steadily "only under an exemption".
  if (conditional && periods.length === 0) {
    return { kind: "conditional", ...base };
  }

  const today = berlinDate(now);
  const todayMMDD = toMMDD(today);

  const active = periods.find((period) => inPeriod(period, todayMMDD));
  if (active) {
    return {
      kind: conditional ? "conditional" : "open",
      activeEnd: active.end,
      ...base,
    };
  }

  let next: { days: number; start: string } | null = null;
  for (const period of periods) {
    const days = daysUntilStart(today, period.start);
    if (next === null || days < next.days) {
      next = { days, start: period.start };
    }
  }

  if (next && next.days <= lookaheadDays) {
    return {
      kind: "soon",
      daysUntilOpen: next.days,
      nextStart: next.start,
      ...base,
    };
  }

  return { kind: "closed", nextStart: next?.start, ...base };
}

// Last day of each month in the fixed non-leap model (matches the 02-28 convention).
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Coarser, month-granular status for the cross-state overview matrix. */
export type MonthStatusKind = "open" | "conditional" | "closed";

function periodOverlapsMonth(period: Period, month: number): boolean {
  const mm = String(month).padStart(2, "0");
  const first = `${mm}-01`;
  const last = `${mm}-${String(MONTH_LAST_DAY[month - 1]).padStart(2, "0")}`;
  // The period covers the month's first or last day, OR a short period sits
  // wholly between them (its start month equals this month).
  return (
    inPeriod(period, first) ||
    inPeriod(period, last) ||
    Number(period.start.slice(0, 2)) === month
  );
}

/**
 * Whether a season is open at any point during a calendar month (1–12). Used by
 * the overview, which is month-granular like the printed Jagdzeiten tables —
 * "open sometime in August" rather than on one exact day.
 */
export function monthStatus(season: Season, month: number): MonthStatusKind {
  if (month < 1 || month > 12) throw new Error(`month out of range: ${month}`);
  const conditional = season.conditional === true;
  if (season.type === "closed") return "closed";
  if (season.type === "year-round") return conditional ? "conditional" : "open";
  const periods = season.periods ?? [];
  if (conditional && periods.length === 0) return "conditional";
  const open = periods.some((p) => periodOverlapsMonth(p, month));
  return open ? (conditional ? "conditional" : "open") : "closed";
}
