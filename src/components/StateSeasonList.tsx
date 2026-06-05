import { useState, type JSX } from "react";
import type { SpeciesGroup } from "../lib/data";
import type { Season } from "../lib/seasons";
import {
  computeStatus,
  type SeasonStatus,
  type StatusKind,
} from "../lib/status";
import { formatMonthDay, seasonCalendarText } from "../lib/format";
import { SeasonStatusBadge } from "./SeasonStatusBadge";

// Open first, then restricted, then soon, then the long tail of closed seasons —
// the prime question is "what can I hunt right now".
const RANK: Record<StatusKind, number> = {
  open: 0,
  conditional: 1,
  soon: 2,
  closed: 3,
};

const DOT: Record<StatusKind, string> = {
  open: "bg-jagd-green",
  conditional: "bg-jagd-amber",
  soon: "bg-jagd-yellow",
  closed: "bg-jagd-red",
};

interface RankedEntry {
  classKey: string | null;
  classLabel: string | null;
  season: Season;
  status: SeasonStatus;
}
interface RankedGroup extends SpeciesGroup {
  entries: RankedEntry[];
  rank: number;
}

function liveText(status: SeasonStatus): string {
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

function rank(groups: SpeciesGroup[], now: Date): RankedGroup[] {
  return groups
    .map((group) => {
      const entries = group.entries.map((e) => ({
        ...e,
        status: computeStatus(e.season, now),
      }));
      const groupRank = Math.min(...entries.map((e) => RANK[e.status.kind]));
      return { ...group, entries, rank: groupRank };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank || a.speciesLabel.localeCompare(b.speciesLabel, "de"),
    );
}

// One line item: text flows and wraps in the left column, the badge stays pinned
// top-right. Used for both a single whole-species and each class sub-row, so the
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

// A species with several genuinely different class seasons. Folded by default
// when every class shares the same status (the headline is uniform, details on
// demand); expanded when they differ. The user can toggle either way.
function SpeciesItem({ group }: { group: RankedGroup }): JSX.Element {
  const speciesLabel = (
    <span className="text-lg font-semibold text-jagd-forest">
      {group.speciesLabel}
    </span>
  );

  if (group.entries.length === 1) {
    const only = group.entries[0];
    return (
      <Row primary={speciesLabel} season={only.season} status={only.status} />
    );
  }

  const kinds = [...new Set(group.entries.map((e) => e.status.kind))].sort(
    (a, b) => RANK[a] - RANK[b],
  );
  const uniform = kinds.length === 1;
  const [open, setOpen] = useState(!uniform);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Chevron open={open} />
          {speciesLabel}
          <span className="text-sm font-normal text-gray-400">
            {group.entries.length} Klassen
          </span>
        </span>
        {!open &&
          (uniform ? (
            <SeasonStatusBadge status={group.entries[0].status} />
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
      </button>
      {open && (
        <div className="mt-1 pl-6">
          {group.entries.map((entry) => (
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

function Summary({ groups }: { groups: RankedGroup[] }): JSX.Element {
  const counts: Record<StatusKind, number> = {
    open: 0,
    conditional: 0,
    soon: 0,
    closed: 0,
  };
  for (const g of groups) for (const e of g.entries) counts[e.status.kind] += 1;

  const items: { kind: StatusKind; label: string }[] = [
    { kind: "open", label: "jetzt offen" },
    { kind: "conditional", label: "mit Auflagen" },
    { kind: "soon", label: "bald" },
    { kind: "closed", label: "Schonzeit" },
  ];

  return (
    <ul className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {items.map((i) => (
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

export function StateSeasonList({
  groups,
}: {
  groups: SpeciesGroup[];
}): JSX.Element {
  const now = new Date();
  const ranked = rank(groups, now);
  const today = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(now);

  return (
    <section aria-label="Jagdzeiten">
      <p className="mb-3 text-sm text-gray-500">Stand: heute, {today}</p>
      <Summary groups={ranked} />
      <ul className="divide-y divide-gray-200">
        {ranked.map((group) => (
          <li key={group.speciesKey} className="py-3">
            <SpeciesItem group={group} />
          </li>
        ))}
      </ul>
    </section>
  );
}
