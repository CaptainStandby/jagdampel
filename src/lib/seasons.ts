export type SeasonType = 'range' | 'year-round' | 'closed';
export type Provenance = 'state' | 'federal';

export interface Period {
  /** MM-DD inclusive */
  start: string;
  /** MM-DD inclusive; a period wraps the year boundary when end < start */
  end: string;
}

export interface Season {
  /** German common name exactly as used in the regulation */
  species: string;
  /** Age/sex class wording (e.g. "Hirsche und Alttiere", "Böcke"); null = whole species */
  class: string | null;
  type: SeasonType;
  /** Present for type "range"; one entry per disjoint open period */
  periods?: Period[];
  /** Open only under legal restrictions */
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

/** A season's merge identity: one regulation entry per species + class. */
const identity = (s: Season): string => `${s.species}\t${s.class ?? ''}`;

/**
 * Compute the hunting seasons in force in a state by overlaying its deltas on the
 * nationwide federal defaults. A state entry replaces the federal entry with the
 * same (species, class); entries with a new identity are additions. Federal entries
 * the state does not touch carry through unchanged.
 *
 * Pure: inputs are not mutated.
 */
export function mergeSeasons(federal: Season[], state: Season[]): Season[] {
  const effective = new Map<string, Season>();
  for (const s of federal) effective.set(identity(s), { ...s, provenance: 'federal' });
  for (const s of state) effective.set(identity(s), { ...s, provenance: 'state' });
  return [...effective.values()];
}
