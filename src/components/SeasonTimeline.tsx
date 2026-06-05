import type { JSX } from "react";
import type { SpeciesGroup } from "../lib/data";
import type { Season } from "../lib/seasons";
import { seasonCalendarText } from "../lib/format";
import { seasonSegments, todayFraction } from "../lib/timeline";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const LABEL_COL = "w-28 shrink-0";

/** The 12-month grid lines behind every bar, so periods read against the calendar. */
function GridLines(): JSX.Element {
  return (
    <div className="absolute inset-0 grid grid-cols-12" aria-hidden>
      {MONTHS.map((_, i) => (
        <span key={i} className="border-l border-white/70 first:border-l-0" />
      ))}
    </div>
  );
}

function Bar({
  label,
  bold = false,
  season,
  todayPct,
}: {
  label: string;
  bold?: boolean;
  season: Season;
  todayPct: number;
}): JSX.Element {
  const segments = seasonSegments(season);
  // A range with no drawable periods is permit-only / no-calendar — same rule the
  // status and text helpers use. Never leave the bar blank against a label that
  // says otherwise; draw a dashed outline (amber when restricted, else neutral).
  const empty = season.type === "range" && segments.length === 0;
  const label2 = [seasonCalendarText(season), season.conditionNotes]
    .filter(Boolean)
    .join(" – ");

  return (
    <div className="flex items-center gap-2 py-0.5">
      <div
        className={`${LABEL_COL} truncate text-sm ${
          bold ? "font-semibold text-jagd-forest" : "text-gray-600"
        }`}
        title={label}
      >
        {label}
      </div>
      <div
        className="relative h-5 flex-1 rounded bg-gray-100"
        role="img"
        aria-label={label2}
        title={label2}
      >
        <GridLines />
        {empty && (
          <div
            className={`absolute inset-0 rounded border border-dashed ${
              season.conditional ? "border-jagd-amber" : "border-gray-400"
            }`}
          />
        )}
        {segments.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-y-0 ${s.conditional ? "bg-jagd-amber" : "bg-jagd-green"}`}
            style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%` }}
          />
        ))}
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-gray-900 ring-1 ring-white/60"
          style={{ left: `${todayPct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function SeasonTimeline({
  groups,
  now,
}: {
  groups: SpeciesGroup[];
  now: Date;
}): JSX.Element {
  const todayPct = todayFraction(now) * 100;

  return (
    <div>
      <div className="sticky top-0 flex items-center gap-2 bg-white py-1">
        <div className={LABEL_COL} />
        <div className="relative flex-1">
          <div className="grid grid-cols-12 text-xs text-gray-400">
            {MONTHS.map((m, i) => (
              <span key={i} className="text-center">
                {m}
              </span>
            ))}
          </div>
          <div
            className="absolute -bottom-3 -translate-x-1/2 text-[10px] whitespace-nowrap text-gray-800"
            style={{ left: `${todayPct}%` }}
          >
            ▾ heute
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const single =
            group.entries.length === 1 && group.entries[0].classKey === null;
          if (single) {
            return (
              <Bar
                key={group.speciesKey}
                label={group.speciesLabel}
                bold
                season={group.entries[0].season}
                todayPct={todayPct}
              />
            );
          }
          return (
            <div key={group.speciesKey}>
              <div className="mb-0.5 font-semibold text-jagd-forest">
                {group.speciesLabel}
              </div>
              {group.entries.map((entry) => (
                <Bar
                  key={entry.season.key}
                  label={entry.classLabel ?? ""}
                  season={entry.season}
                  todayPct={todayPct}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
