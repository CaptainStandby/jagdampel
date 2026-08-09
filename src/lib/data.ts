import federalData from "../../data/federal.json";
import taxonomyData from "../../data/taxonomy.json";
import { mergeSeasons, effectiveClassLabel } from "./seasons";
import type { Season, SeasonsFile, Taxonomy } from "./seasons";
import { stateName } from "./states";

export const taxonomy = taxonomyData as unknown as Taxonomy;
const federal = federalData as unknown as SeasonsFile;

// Auto-discover every state delta file. Adding data/states/xx.json is enough —
// no registry to maintain. Eager so the data is inlined into the static build.
const stateModules = import.meta.glob<{ default: SeasonsFile }>(
  "../../data/states/*.json",
  { eager: true },
);

const states: Map<string, SeasonsFile> = new Map();
for (const mod of Object.values(stateModules)) {
  const file = mod.default;
  if (file.state) states.set(file.state.toUpperCase(), file);
}

export interface StateSummary {
  code: string;
  name: string;
}

/** States we actually have a delta layer for — the only ones safe to publish. */
export function availableStates(): StateSummary[] {
  return [...states.values()]
    .map((f) => ({
      code: f.state!.toUpperCase(),
      name: f.name ?? stateName(f.state!),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** One species and its (class-level) effective seasons, ready for display. */
export interface SpeciesGroup {
  speciesKey: string;
  speciesLabel: string;
  tags: string[];
  entries: {
    classKey: string | null;
    classLabel: string | null;
    season: Season;
  }[];
}

export interface StateSeasons {
  code: string;
  name: string;
  source: SeasonsFile["source"];
  groups: SpeciesGroup[];
}

// Memoization cache for getStateSeasons — the underlying data is fully static
// so results never change within a build.
const stateSeasonsCache = new Map<string, StateSeasons | null>();

/**
 * The effective hunting seasons for a state — federal defaults overlaid with the
 * state's deltas — grouped by species and ordered for display. Returns null for
 * states we hold no data for (we never publish unverified federal-only guesses).
 */
export function getStateSeasons(code: string): StateSeasons | null {
  const key = code.toUpperCase();

  const cached = stateSeasonsCache.get(key);
  if (cached !== undefined) return cached;

  const file = states.get(key);
  if (!file) {
    stateSeasonsCache.set(key, null);
    return null;
  }

  const effective = mergeSeasons(federal.seasons, file.seasons, taxonomy);
  const result: StateSeasons = {
    code: file.state!.toUpperCase(),
    name: file.name ?? stateName(file.state!),
    source: file.source,
    groups: groupBySpecies(effective),
  };
  stateSeasonsCache.set(key, result);
  return result;
}

/** One species' effective seasons in one state — a slice of that state's view. */
export interface SpeciesStateSeasons {
  code: string;
  name: string;
  entries: SpeciesGroup["entries"];
}

/** One species seen across every state it occurs in — the `/species/[slug]` view. */
export interface SpeciesDetail {
  speciesKey: string;
  speciesLabel: string;
  tags: string[];
  states: SpeciesStateSeasons[];
}

/** Every species in the taxonomy, for getStaticPaths. Sorted by German label. */
export function availableSpecies(): { key: string; label: string }[] {
  return Object.entries(taxonomy.species)
    .map(([key, species]) => ({ key, label: species.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

/**
 * One species' seasons across all published states — the inverse of
 * `getStateSeasons`. Reuses the per-state merge+group so the class collapse
 * matches the state page exactly. Returns null for a key not in the taxonomy.
 */
export function getSpeciesDetail(speciesKey: string): SpeciesDetail | null {
  const species = taxonomy.species[speciesKey];
  if (!species) return null;

  const perState: SpeciesStateSeasons[] = [];
  for (const summary of availableStates()) {
    const state = getStateSeasons(summary.code);
    if (!state) continue;
    const group = state.groups.find((g) => g.speciesKey === speciesKey);
    if (!group) continue;
    perState.push({
      code: state.code,
      name: state.name,
      entries: group.entries,
    });
  }

  return {
    speciesKey,
    speciesLabel: species.label,
    tags: species.tags ?? [],
    states: perState,
  };
}

/** One row of the cross-state overview: a species (or class) across all states. */
export interface MatrixRow {
  key: string;
  speciesKey: string;
  speciesLabel: string;
  classLabel: string | null;
  tags: string[];
  /** One per state (same order as `SeasonMatrix.states`); null = not in that state's Jagdrecht. */
  cells: (Season | null)[];
}

export interface SeasonMatrix {
  states: StateSummary[];
  readonly rows: readonly MatrixRow[];
}

/**
 * The cross-state overview. Rows are the union of every species/class key that
 * occurs in any state (taxonomy order, NOT per-state-collapsed so columns stay
 * aligned); columns are the available states. Each cell holds that state's
 * effective season, or null when the species isn't in that state's Jagdrecht.
 */
export function buildMatrix(): SeasonMatrix {
  const summaries = availableStates();
  const perState = summaries.map((s) => {
    const file = states.get(s.code)!;
    const effective = mergeSeasons(federal.seasons, file.seasons, taxonomy);
    return new Map(effective.map((season) => [season.key, season]));
  });

  const rows: MatrixRow[] = [];
  for (const [speciesKey, species] of Object.entries(taxonomy.species)) {
    const classKeys = Object.keys(species.classes ?? {});
    const keyed = classKeys.length
      ? classKeys.map((c) => ({ key: `${speciesKey}/${c}`, classKey: c }))
      : [{ key: speciesKey, classKey: null as string | null }];
    for (const { key, classKey } of keyed) {
      const cells = perState.map((m) => m.get(key) ?? null);
      if (cells.every((c) => c === null)) continue;
      rows.push({
        key,
        speciesKey,
        speciesLabel: species.label,
        // Canonical taxonomy label only — a per-state `term` is intentionally
        // ignored here: a matrix row spans all state columns, so it must show one
        // comparable label. Regional terms surface in the per-state detail view.
        classLabel: classKey
          ? (species.classes[classKey]?.label ?? classKey)
          : null,
        tags: species.tags ?? [],
        cells,
      });
    }
  }

  return { states: summaries, rows };
}

/**
 * The overview matrix sliced to a single species — its rows (the whole-species
 * row and/or class atoms) across all states. A valid SeasonMatrix, so
 * perStateView consumes it unchanged; slim enough to serialize into a species
 * page's island props without shipping the full matrix.
 */
export function speciesMatrix(speciesKey: string): SeasonMatrix {
  const full = buildMatrix();
  return {
    states: full.states,
    rows: full.rows.filter((r) => r.speciesKey === speciesKey),
  };
}

/** Two seasons are display-identical when nothing the UI shows differs. */
function seasonsEqual(a: Season, b: Season): boolean {
  if (a.type !== b.type) return false;
  if ((a.conditional ?? false) !== (b.conditional ?? false)) return false;
  if ((a.conditionNotes ?? null) !== (b.conditionNotes ?? null)) return false;
  if ((a.notes ?? null) !== (b.notes ?? null)) return false;
  const pa = a.periods ?? [];
  const pb = b.periods ?? [];
  return (
    pa.length === pb.length &&
    pa.every((p, i) => p.start === pb[i].start && p.end === pb[i].end)
  );
}

function groupBySpecies(seasons: Season[]): SpeciesGroup[] {
  const bySpecies = new Map<string, Season[]>();
  for (const season of seasons) {
    const speciesKey = season.key.split("/")[0];
    const list = bySpecies.get(speciesKey) ?? [];
    list.push(season);
    bySpecies.set(speciesKey, list);
  }

  const groups: SpeciesGroup[] = [];
  for (const [speciesKey, list] of bySpecies) {
    const species = taxonomy.species[speciesKey];
    const classOrder = Object.keys(species?.classes ?? {});
    const entries = list
      .map((season) => {
        const classKey = season.key.includes("/")
          ? season.key.split("/")[1]
          : null;
        return {
          classKey,
          classLabel: effectiveClassLabel(season, taxonomy),
          season,
        };
      })
      .sort(
        (a, b) =>
          classOrder.indexOf(a.classKey ?? "") -
          classOrder.indexOf(b.classKey ?? ""),
      );

    // Collapse class atoms that all resolve to the same season. They only exist
    // because another state's law splits this species and the taxonomy gained
    // those atoms; here the local law doesn't differentiate, so show one row.
    const collapsed =
      entries.length > 1 &&
      entries.every((e) => e.classKey !== null) &&
      // A regional `term` means these classes are NOT interchangeable, even if
      // their dates match — never collapse them into one species-level row.
      entries.every((e) => e.season.term === undefined) &&
      entries.every((e) => seasonsEqual(e.season, entries[0].season))
        ? [
            {
              classKey: null,
              classLabel: null,
              season: { ...entries[0].season, key: speciesKey },
            },
          ]
        : entries;

    groups.push({
      speciesKey,
      speciesLabel: species?.label ?? speciesKey,
      tags: species?.tags ?? [],
      entries: collapsed,
    });
  }

  return groups.sort((a, b) =>
    a.speciesLabel.localeCompare(b.speciesLabel, "de"),
  );
}
