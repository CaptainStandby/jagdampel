import { useState, type JSX } from "react";
import type { Season } from "../lib/seasons";
import type { SeasonStatus, StatusKind } from "../lib/status";
import { formatMonthDay, seasonCalendarText } from "../lib/format";
import { SeasonStatusBadge } from "./SeasonStatusBadge";

// Open first, then restricted, then soon, then the long tail of closed seasons —
// the prime question is always "what can I do right now".
export const RANK: Record<StatusKind, number> = {
  open: 0,
  conditional: 1,
  soon: 2,
  closed: 3,
};

export const DOT: Record<StatusKind, string> = {
  open: "bg-jagd-green",
  conditional: "bg-jagd-amber",
  soon: "bg-jagd-yellow",
  closed: "bg-jagd-red",
};

/** One class-level season with its live traffic-light status attached. */
export interface StatusEntry {
  classKey: string | null;
  classLabel: string | null;
  season: Season;
  status: SeasonStatus;
}

export function liveText(status: SeasonStatus): string {
  switch (status.kind) {
    case "open":
      return status.activeEnd
        ? `noch bis ${formatMonthDay(status.activeEnd)}`
        : "";
    case "conditional":
      return status.activeEnd
        ? `noch bis ${formatMonthDay(status.activeEnd)}`
        : "nur mit Ausnahmegenehmigung";
    case "soon": {
      const days = status.daysUntilOpen ?? 0;
      const when = status.nextStart
        ? `ab ${formatMonthDay(status.nextStart)}`
        : "";
      return `${when} · in ${days} ${days === 1 ? "Tag" : "Tagen"}`;
    }
    case "closed":
      return status.nextStart
        ? `wieder ab ${formatMonthDay(status.nextStart)}`
        : "ganzjährig geschont";
  }
}

// One line item: text flows and wraps in the left column, the badge stays pinned
// top-right. Used for both a single whole entry and each class sub-row, so the
// two can never drift apart.
function Row({
  primary,
  season,
  status,
}: {
  primary: JSX.Element;
  season: Season;
  status: SeasonStatus;
}): JSX.Element {
  const detail = liveText(status);
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0 flex-1">
        {primary}{" "}
        <span className="text-sm text-gray-500">
          {seasonCalendarText(season)}
        </span>
        {detail && <div className="text-sm text-gray-600">{detail}</div>}
        {season.conditional && season.conditionNotes && (
          <p className="mt-0.5 text-sm text-gray-500">
            {season.conditionNotes}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <SeasonStatusBadge status={status} />
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M5 3l6 5-6 5z" />
    </svg>
  );
}

// A title with several genuinely different class seasons. Folded by default when
// every class shares the same status (the headline is uniform, details on demand);
// expanded when they differ. The fold toggle is the chevron + count, kept separate
// from the title so an optional title link never nests inside the toggle button.
function FoldableGroup({
  titleEl,
  entries,
}: {
  titleEl: JSX.Element;
  entries: StatusEntry[];
}): JSX.Element {
  const kinds = [...new Set(entries.map((e) => e.status.kind))].sort(
    (a, b) => RANK[a] - RANK[b],
  );
  const uniform = kinds.length === 1;
  const [open, setOpen] = useState(!uniform);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {titleEl}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex shrink-0 items-center gap-1 text-sm text-gray-400 hover:text-jagd-forest"
          >
            <Chevron open={open} />
            {entries.length} Klassen
          </button>
        </div>
        {!open &&
          (uniform ? (
            <SeasonStatusBadge status={entries[0].status} />
          ) : (
            <span className="flex shrink-0 gap-1">
              {kinds.map((k) => (
                <span
                  key={k}
                  className={`inline-block h-3 w-3 rounded-full ${DOT[k]}`}
                  aria-hidden
                />
              ))}
            </span>
          ))}
      </div>
      {open && (
        <div className="mt-1 pl-6">
          {entries.map((entry) => (
            <Row
              key={entry.season.key}
              primary={<span className="font-medium">{entry.classLabel}</span>}
              season={entry.season}
              status={entry.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A labelled thing (a species on a state page, a state on a species page) with one
 * or more class-level seasons and a live traffic-light. A single entry renders as
 * one row; several render as a foldable group. `href` makes the title a link to the
 * related page.
 */
export function SeasonGroup({
  title,
  href,
  entries,
}: {
  title: string;
  href?: string;
  entries: StatusEntry[];
}): JSX.Element {
  const titleEl = href ? (
    <a
      href={href}
      className="text-lg font-semibold text-jagd-forest hover:underline"
    >
      {title}
    </a>
  ) : (
    <span className="text-lg font-semibold text-jagd-forest">{title}</span>
  );

  if (entries.length === 1) {
    const only = entries[0];
    return <Row primary={titleEl} season={only.season} status={only.status} />;
  }
  return <FoldableGroup titleEl={titleEl} entries={entries} />;
}

const SUMMARY_ITEMS: { kind: StatusKind; label: string }[] = [
  { kind: "open", label: "jetzt offen" },
  { kind: "conditional", label: "mit Auflagen" },
  { kind: "soon", label: "bald" },
  { kind: "closed", label: "Schonzeit" },
];

/** The traffic-light count strip. Counts are supplied by the caller (entries on a
 *  state page, states on a species page) so the same legend serves both. */
export function StatusSummary({
  counts,
}: {
  counts: Record<StatusKind, number>;
}): JSX.Element {
  return (
    <ul className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {SUMMARY_ITEMS.map((i) => (
        <li key={i.kind} className="flex items-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${DOT[i.kind]}`}
            aria-hidden
          />
          <span className="font-semibold">{counts[i.kind]}</span>
          <span className="text-gray-600">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}
