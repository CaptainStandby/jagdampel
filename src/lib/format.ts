import type { Period, Season } from "./seasons";

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** "09-01" → "1. September". */
export function formatMonthDay(mmdd: string): string {
  const [month, day] = mmdd.split("-").map(Number);
  return `${day}. ${MONTHS_DE[month - 1]}`;
}

/** "1. September – 31. Januar" for one open window. */
export function formatPeriod(period: Period): string {
  return `${formatMonthDay(period.start)} – ${formatMonthDay(period.end)}`;
}

/** The season's calendar in words, independent of today's date. */
export function seasonCalendarText(season: Season): string {
  if (season.type === "year-round") return "ganzjährig";
  if (season.type === "closed") return "keine Jagdzeit";
  const periods = season.periods ?? [];
  if (periods.length === 0) return "nur mit Ausnahmegenehmigung";
  return periods.map(formatPeriod).join(" · ");
}
