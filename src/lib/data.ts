import federalData from "../../data/federal.json";
import taxonomyData from "../../data/taxonomy.json";
import { mergeSeasons } from "./seasons";
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

/**
 * The effective hunting seasons for a state — federal defaults overlaid with the
 * state's deltas — grouped by species and ordered for display. Returns null for
 * states we hold no data for (we never publish unverified federal-only guesses).
 */
export function getStateSeasons(code: string): StateSeasons | null {
  const file = states.get(code.toUpperCase());
  if (!file) return null;

  const effective = mergeSeasons(federal.seasons, file.seasons, taxonomy);
  return {
    code: file.state!.toUpperCase(),
    name: file.name ?? stateName(file.state!),
    source: file.source,
    groups: groupBySpecies(effective),
  };
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
          classLabel: classKey
            ? (species?.classes?.[classKey]?.label ?? classKey)
            : null,
          season,
        };
      })
      .sort(
        (a, b) =>
          classOrder.indexOf(a.classKey ?? "") -
          classOrder.indexOf(b.classKey ?? ""),
      );

    groups.push({
      speciesKey,
      speciesLabel: species?.label ?? speciesKey,
      tags: species?.tags ?? [],
      entries,
    });
  }

  return groups.sort((a, b) =>
    a.speciesLabel.localeCompare(b.speciesLabel, "de"),
  );
}
