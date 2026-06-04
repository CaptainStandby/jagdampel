export type SeasonType = "range" | "year-round" | "closed";
export type Provenance = "state" | "federal";

export interface Period {
  /** MM-DD inclusive */
  start: string;
  /** MM-DD inclusive; a period wraps the year boundary when end < start */
  end: string;
}

export interface Season {
  /**
   * Universal match key: a `speciesKey` from the taxonomy, optionally with a
   * `/classKey` suffix (e.g. "reh/ricke", "fuchs/jung", "dachs"). This — not the
   * verbatim regulation wording — is what merging matches on. Verbatim wording
   * lives in `notes` as flavour.
   */
  key: string;
  type: SeasonType;
  /** Present for type "range"; one entry per disjoint open period */
  periods?: Period[];
  /** Open only under legal restrictions (incl. permit-only: empty periods) */
  conditional?: boolean;
  conditionNotes?: string | null;
  notes?: string | null;
  /** Stamped by mergeSeasons: which layer the effective season came from */
  provenance?: Provenance;
}

export interface SeasonsFile {
  state?: string;
  name?: string;
  source?: Record<string, string>;
  seasons: Season[];
}

export interface TaxonomyClass {
  label: string;
}
export interface TaxonomySpecies {
  label: string;
  tags?: string[];
  classes: Record<string, TaxonomyClass>;
}
export interface Taxonomy {
  species: Record<string, TaxonomySpecies>;
}

const speciesKeyOf = (key: string): string => key.split("/")[0];
const isWhole = (key: string): boolean => !key.includes("/");

/**
 * Resolve one layer into a key -> Season map, expanding whole-species entries
 * into their class atoms. A whole entry (key without "/") for a species that the
 * taxonomy splits is expanded to one entry per class, inheriting the season.
 * Explicit class-level entries are applied last so they override expansions —
 * this is what lets a layer carry both a broad season and a per-class exception
 * (e.g. federal `fasan` open + state `fasan/henne` closed).
 */
function resolveLayer(
  seasons: Season[],
  taxonomy: Taxonomy,
): Map<string, Season> {
  const resolved = new Map<string, Season>();

  for (const season of seasons) {
    if (!isWhole(season.key)) continue;
    const atoms = taxonomy.species[season.key]?.classes ?? {};
    const atomKeys = Object.keys(atoms);
    if (atomKeys.length === 0) {
      resolved.set(season.key, season);
      continue;
    }
    for (const atom of atomKeys) {
      const key = `${season.key}/${atom}`;
      resolved.set(key, { ...season, key });
    }
  }

  for (const season of seasons) {
    if (isWhole(season.key)) continue;
    resolved.set(season.key, season);
  }

  return resolved;
}

/**
 * Compute the hunting seasons in force in a state by overlaying its deltas on the
 * nationwide federal defaults. Both layers are resolved against the taxonomy, then
 * the state's entries replace federal entries with the same key; entries with a new
 * key are additions. Each effective entry is stamped with its `provenance`.
 *
 * Pure: inputs are not mutated.
 */
export function mergeSeasons(
  federal: Season[],
  state: Season[],
  taxonomy: Taxonomy,
): Season[] {
  const effective = new Map<string, Season>();
  for (const [key, season] of resolveLayer(federal, taxonomy)) {
    effective.set(key, { ...season, provenance: "federal" });
  }
  for (const [key, season] of resolveLayer(state, taxonomy)) {
    effective.set(key, { ...season, provenance: "state" });
  }
  return [...effective.values()];
}

/** Display label for a season's species, from the taxonomy. */
export function speciesLabel(key: string, taxonomy: Taxonomy): string {
  const sk = speciesKeyOf(key);
  return taxonomy.species[sk]?.label ?? sk;
}

/** Display label for a season's class, from the taxonomy (null for whole-species). */
export function classLabel(key: string, taxonomy: Taxonomy): string | null {
  const [sk, ck] = key.split("/");
  if (!ck) return null;
  return taxonomy.species[sk]?.classes[ck]?.label ?? ck;
}
