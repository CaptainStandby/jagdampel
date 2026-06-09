import { useEffect, useState, type JSX } from "react";
import type { MatrixRow, SeasonMatrix as Matrix } from "../lib/data";
import { monthStatus, type MonthStatusKind } from "../lib/status";
import { seasonCalendarText } from "../lib/format";
import {
  applyParam,
  HUNTABLE_PARAM,
  matchesSearch,
  matchesTags,
  readBoolFromUrl,
  readTagsFromUrl,
  serializeTags,
  TAGS_PARAM,
} from "../lib/filters";
import { CategoryFilter } from "./CategoryFilter";
import { HuntableToggle } from "./HuntableToggle";
import { SpeciesSearch } from "./SpeciesSearch";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];
const MONTHS_LONG = [
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

const CELL_COLOR: Record<MonthStatusKind, string> = {
  open: "bg-jagd-green",
  conditional: "bg-jagd-amber",
  closed: "bg-jagd-red",
};
const ABSENT_COLOR = "bg-gray-200";

const MONTH_PARAM = "month";

function berlinMonth(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      month: "2-digit",
    }).format(now),
  );
}

function readMonthFromUrl(fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = Number(
    new URLSearchParams(window.location.search).get(MONTH_PARAM),
  );
  return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : fallback;
}

function writeUrl(
  month: number,
  tags: ReadonlySet<string>,
  onlyHuntable: boolean,
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(MONTH_PARAM, String(month));
  applyParam(url, TAGS_PARAM, serializeTags(tags));
  applyParam(url, HUNTABLE_PARAM, onlyHuntable ? "1" : "");
  window.history.replaceState(null, "", url);
}

/** A row open in no shown state at any time — every present cell is a Schonzeit. */
function isRowAllYearClosed(row: MatrixRow): boolean {
  const present = row.cells.filter((c) => c !== null);
  return present.every((c) => c!.type === "closed");
}

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`inline-block h-4 w-4 rounded-sm ${color}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function SeasonMatrix({ matrix }: { matrix: Matrix }): JSX.Element {
  const [month, setMonth] = useState<number>(() =>
    readMonthFromUrl(berlinMonth(new Date())),
  );
  const [tags, setTags] = useState<Set<string>>(readTagsFromUrl);
  const [onlyHuntable, setOnlyHuntable] = useState<boolean>(() =>
    readBoolFromUrl(HUNTABLE_PARAM),
  );
  const [search, setSearch] = useState("");
  useEffect(
    () => writeUrl(month, tags, onlyHuntable),
    [month, tags, onlyHuntable],
  );

  if (matrix.states.length === 0) {
    return <p className="text-gray-500">Noch keine Bundesländer erfasst.</p>;
  }

  const available = new Set<string>();
  for (const row of matrix.rows) for (const t of row.tags) available.add(t);

  const rows = matrix.rows.filter(
    (row) =>
      matchesTags(row.tags, tags) &&
      matchesSearch(`${row.speciesLabel} ${row.classLabel ?? ""}`, search) &&
      (!onlyHuntable || !isRowAllYearClosed(row)),
  );

  const toggleTag = (key: string): void =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div
        className="mb-3 flex flex-wrap gap-1"
        role="group"
        aria-label="Monat wählen"
      >
        {MONTHS_SHORT.map((label, i) => {
          const value = i + 1;
          const active = value === month;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setMonth(value)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                active
                  ? "bg-jagd-forest text-white"
                  : "text-gray-600 hover:text-jagd-forest"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <SpeciesSearch value={search} onChange={setSearch} />
      </div>

      <CategoryFilter
        selected={tags}
        available={available}
        onToggle={toggleTag}
        onClear={() => setTags(new Set())}
      />
      <HuntableToggle checked={onlyHuntable} onChange={setOnlyHuntable} />

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
        <Legend color="bg-jagd-green" label="Jagdzeit" />
        <Legend color="bg-jagd-amber" label="Mit Auflagen" />
        <Legend color="bg-jagd-red" label="Schonzeit" />
        <Legend color={ABSENT_COLOR} label="nicht im Jagdrecht" />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-jagd-forest">
        Jagdzeiten im {MONTHS_LONG[month - 1]}
      </h2>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          Keine Arten für diese Auswahl.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Jagdzeiten im {MONTHS_LONG[month - 1]} je Bundesland
            </caption>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-white py-1 pr-3 text-left">
                  Art
                </th>
                {matrix.states.map((s) => (
                  <th
                    key={s.code}
                    title={s.name}
                    className="sticky top-0 z-10 bg-white px-1 py-1 text-center font-semibold text-jagd-forest"
                  >
                    {s.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white py-0.5 pr-3 text-left font-normal whitespace-nowrap"
                  >
                    <span className="font-medium text-jagd-forest">
                      {row.speciesLabel}
                    </span>
                    {row.classLabel && (
                      <span className="text-gray-500">: {row.classLabel}</span>
                    )}
                  </th>
                  {row.cells.map((season, i) => {
                    const kind = season ? monthStatus(season, month) : null;
                    const color = kind ? CELL_COLOR[kind] : ABSENT_COLOR;
                    const state = matrix.states[i];
                    const detail = season
                      ? seasonCalendarText(season)
                      : "nicht im Jagdrecht";
                    const label = `${state.name} — ${row.speciesLabel}${
                      row.classLabel ? `: ${row.classLabel}` : ""
                    }: ${detail}`;
                    return (
                      <td key={state.code} className="px-0.5 py-0.5">
                        <div
                          className={`h-6 w-9 rounded-sm ${color}`}
                          role="img"
                          aria-label={label}
                          title={label}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
