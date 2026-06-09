import { type JSX } from "react";
import type { SpeciesStateSeasons } from "../lib/data";
import { computeStatus, type StatusKind } from "../lib/status";
import { href } from "../lib/paths";
import {
  RANK,
  SeasonGroup,
  StatusSummary,
  type StatusEntry,
} from "./SeasonGroup";

// The kind a state is counted under: its best (lowest-rank) entry status.
const KIND_BY_RANK: StatusKind[] = ["open", "conditional", "soon", "closed"];

interface RankedState extends SpeciesStateSeasons {
  entries: StatusEntry[];
  rank: number;
}

function rank(states: SpeciesStateSeasons[], now: Date): RankedState[] {
  return states
    .map((state) => {
      const entries: StatusEntry[] = state.entries.map((e) => ({
        ...e,
        status: computeStatus(e.season, now),
      }));
      const stateRank = Math.min(...entries.map((e) => RANK[e.status.kind]));
      return { ...state, entries, rank: stateRank };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "de"));
}

/**
 * One species across every published Bundesland, ranked open-first so "where can I
 * hunt this right now" reads at a glance. The inverse of the per-state list; both
 * share the SeasonGroup item, here titled by state and linking to the state page.
 */
export function SpeciesStateList({
  states,
}: {
  states: SpeciesStateSeasons[];
}): JSX.Element {
  const now = new Date();
  const ranked = rank(states, now);

  // Each state counts once, under its headline (best) status.
  const counts: Record<StatusKind, number> = {
    open: 0,
    conditional: 0,
    soon: 0,
    closed: 0,
  };
  for (const state of ranked) counts[KIND_BY_RANK[state.rank]] += 1;

  const today = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(now);

  return (
    <section aria-label="Jagdzeiten je Bundesland">
      <p className="mb-4 text-sm text-gray-500">Stand: heute, {today}</p>
      <StatusSummary counts={counts} />
      <ul className="divide-y divide-gray-200">
        {ranked.map((state) => (
          <li key={state.code} className="py-3">
            <SeasonGroup
              title={state.name}
              href={href(`state/${state.code.toLowerCase()}`)}
              entries={state.entries}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
