import { useEffect, useMemo, useState, type JSX } from "react";
import type { SpeciesGroup } from "../lib/data";
import { computeStatus, type StatusKind } from "../lib/status";
import {
  applyParam,
  HUNTABLE_PARAM,
  matchesSearch,
  matchesTags,
  readBoolFromUrl,
  readStringFromUrl,
  readTagsFromUrl,
  SEARCH_PARAM,
  serializeTags,
  TAGS_PARAM,
} from "../lib/filters";
import { href } from "../lib/paths";
import {
  RANK,
  SeasonGroup,
  StatusSummary,
  type StatusEntry,
} from "./SeasonGroup";
import { SeasonTimeline } from "./SeasonTimeline";
import { CategoryFilter } from "./CategoryFilter";
import { HuntableToggle } from "./HuntableToggle";
import { SpeciesSearch } from "./SpeciesSearch";

const BERLIN_LONG_DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

type View = "list" | "calendar";

// view stays a per-page param; the tag + huntable params are shared (filters.ts)
// so this view and the overview filter identically.
const VIEW_PARAM = "view";

function readViewFromUrl(): View {
  if (typeof window === "undefined") return "list";
  return new URLSearchParams(window.location.search).get(VIEW_PARAM) ===
    "calendar"
    ? "calendar"
    : "list";
}

function writeUrl(
  view: View,
  tags: ReadonlySet<string>,
  onlyHuntable: boolean,
  search: string,
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(VIEW_PARAM, view);
  applyParam(url, TAGS_PARAM, serializeTags(tags));
  applyParam(url, HUNTABLE_PARAM, onlyHuntable ? "1" : "");
  applyParam(url, SEARCH_PARAM, search);
  window.history.replaceState(null, "", url);
}

/** A species with no open season at all — every entry is a Schonzeit. */
const isAllYearClosed = (group: SpeciesGroup): boolean =>
  group.entries.every((e) => e.season.type === "closed");

interface RankedGroup extends SpeciesGroup {
  entries: StatusEntry[];
  rank: number;
}

function rank(groups: SpeciesGroup[], now: Date): RankedGroup[] {
  return groups
    .map((group) => {
      const entries: StatusEntry[] = group.entries.map((e) => ({
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

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}): JSX.Element {
  const options: { value: View; label: string }[] = [
    { value: "list", label: "Liste" },
    { value: "calendar", label: "Kalender" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={view === o.value}
          className={`rounded-md px-3 py-1 font-medium ${
            view === o.value
              ? "bg-jagd-forest text-white"
              : "text-gray-600 hover:text-jagd-forest"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StateSeasonList({
  groups,
}: {
  groups: SpeciesGroup[];
}): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<View>(readViewFromUrl);
  const [tags, setTags] = useState<Set<string>>(readTagsFromUrl);
  const [onlyHuntable, setOnlyHuntable] = useState<boolean>(() =>
    readBoolFromUrl(HUNTABLE_PARAM),
  );
  const [search, setSearch] = useState(() => readStringFromUrl(SEARCH_PARAM));

  // Refresh `now` every 60s so the UI stays correct across day boundaries.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Single URL-sync path: writes on change and normalises a bare URL on load.
  useEffect(
    () => writeUrl(view, tags, onlyHuntable, search),
    [view, tags, onlyHuntable, search],
  );

  const available = new Set<string>();
  for (const group of groups) for (const t of group.tags) available.add(t);

  // Rank ALL groups first — this is the expensive step (computeStatus + sort)
  // and only needs to rerun when the dataset or the clock changes.
  const allRanked = useMemo(() => rank(groups, now), [groups, now]);

  // Filter the ranked collection — cheap array filter that reuses the
  // already-computed status/ranking on every search/tag/toggle change.
  const ranked = useMemo(
    () =>
      allRanked.filter(
        (group) =>
          matchesTags(group.tags, tags) &&
          matchesSearch(group.speciesLabel, search) &&
          (!onlyHuntable || !isAllYearClosed(group)),
      ),
    [allRanked, tags, search, onlyHuntable],
  );

  // Calendar view needs groups in original (alphabetic) order, not status-ranked.
  // Derive from the filtered keys to avoid running predicates a second time.
  const filtered = useMemo(() => {
    const keys = new Set(ranked.map((g) => g.speciesKey));
    return groups.filter((g) => keys.has(g.speciesKey));
  }, [ranked, groups]);

  const counts = useMemo(() => {
    const c: Record<StatusKind, number> = {
      open: 0,
      conditional: 0,
      soon: 0,
      closed: 0,
    };
    for (const g of ranked) for (const e of g.entries) c[e.status.kind] += 1;
    return c;
  }, [ranked]);

  const toggleTag = (key: string): void =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const today = BERLIN_LONG_DATE_FMT.format(now);

  return (
    <section aria-label="Jagdzeiten">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Stand: heute, {today}</p>
        <ViewToggle view={view} onChange={setView} />
      </div>
      <div className="mb-4">
        <SpeciesSearch value={search} onChange={setSearch} />
      </div>
      <CategoryFilter
        selected={tags}
        available={available}
        onToggle={toggleTag}
        onClear={() => setTags(new Set())}
      />
      <HuntableToggle checked={onlyHuntable} onChange={setOnlyHuntable} />
      {ranked.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          Keine Arten für diese Auswahl.
        </p>
      ) : view === "list" ? (
        <>
          <StatusSummary counts={counts} />
          <ul className="divide-y divide-gray-200">
            {ranked.map((group) => (
              <li key={group.speciesKey} className="py-3">
                <SeasonGroup
                  title={group.speciesLabel}
                  href={href(`species/${group.speciesKey}`)}
                  entries={group.entries}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <SeasonTimeline groups={filtered} now={now} />
      )}
    </section>
  );
}
