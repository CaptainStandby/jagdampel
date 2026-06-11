import { mergeSeasons } from "./seasons.ts";
import type { Season, SeasonsFile, Taxonomy } from "./seasons.ts";

/** One state's raw delta file, tagged with its filename for error messages. */
export interface StateFile {
  file: string;
  data: SeasonsFile;
}

const KEY = /^[a-z0-9]+(\/[a-z0-9-]+)?$/;
const DATE = /^\d{2}-\d{2}$/;
const TYPES = new Set<Season["type"]>(["range", "year-round", "closed"]);

/** Species the taxonomy splits into class atoms — a bare key for one of these
 *  must never survive the merge; whole→atom expansion has to replace it. */
function splitSpecies(taxonomy: Taxonomy): string[] {
  return Object.entries(taxonomy.species)
    .filter(([, s]) => Object.keys(s.classes ?? {}).length > 0)
    .map(([k]) => k);
}

function validateEntry(
  scope: string,
  s: Season,
  taxonomy: Taxonomy,
  problems: string[],
): void {
  const push = (m: string) => problems.push(`${scope}: ${m}`);

  if (!KEY.test(s.key)) {
    push(`malformed key '${s.key}'`);
    return;
  }
  const [sk, ck] = s.key.split("/");
  if (!taxonomy.species[sk])
    push(`'${s.key}' species '${sk}' missing from taxonomy`);
  if (ck && !taxonomy.species[sk]?.classes?.[ck])
    push(`'${s.key}' class '${ck}' missing from taxonomy`);
  if (!TYPES.has(s.type)) push(`'${s.key}' invalid type '${s.type}'`);

  // A plain open season needs at least one period; permit-only (conditional) and
  // year-round/closed legitimately carry none.
  if (s.type === "range" && !s.conditional) {
    if (!Array.isArray(s.periods) || s.periods.length < 1)
      push(`'${s.key}' range needs >=1 period`);
  }
  for (const period of s.periods ?? []) {
    if (!DATE.test(period.start) || !DATE.test(period.end))
      push(`'${s.key}' bad period ${JSON.stringify(period)}`);
    // No leap-day handling: the law's 28.02. is stored verbatim; a 02-29 boundary
    // would silently roll to 01.03. in the status math.
    if (period.start === "02-29" || period.end === "02-29")
      push(`'${s.key}' uses 02-29 — store 02-28 (no leap-day handling)`);
  }
  if (s.conditional && !s.conditionNotes)
    push(`'${s.key}' conditional but no conditionNotes`);
}

/**
 * Validate the whole data model end to end: taxonomy tags, the Hoch-/Niederwild
 * partition, every federal + state entry against the taxonomy and schema rules,
 * and the post-merge invariants for each state. Pure — callers supply the loaded
 * data, so it runs identically from a Vitest suite (real data) and the import
 * skill's verifier. Returns a list of human-readable problems; empty means valid.
 */
export function validateData(
  taxonomy: Taxonomy,
  federal: SeasonsFile,
  states: StateFile[],
  allowedTags: ReadonlySet<string>,
  // Injected so the post-merge guards (which a correct mergeSeasons can never
  // trip from valid input) remain testable with a deliberately broken merge.
  merge: (
    federal: Season[],
    state: Season[],
    taxonomy: Taxonomy,
  ) => Season[] = mergeSeasons,
): string[] {
  const problems: string[] = [];

  // Every taxonomy tag must come from the controlled vocabulary (tags.ts).
  for (const [key, sp] of Object.entries(taxonomy.species)) {
    for (const t of sp.tags ?? []) {
      if (!allowedTags.has(t))
        problems.push(`taxonomy: species '${key}' has unknown tag '${t}'`);
    }
  }

  // Hoch-/Niederwild is an exhaustive, mutually exclusive partition (§ 2 Abs. 1
  // BJagdG): every species must carry exactly one of the two.
  for (const [key, sp] of Object.entries(taxonomy.species)) {
    const tags = sp.tags ?? [];
    const n =
      (tags.includes("hochwild") ? 1 : 0) +
      (tags.includes("niederwild") ? 1 : 0);
    if (n !== 1)
      problems.push(
        `taxonomy: species '${key}' must carry exactly one of hochwild/niederwild (has ${n})`,
      );
  }

  // Validate the base layer and every delta against the taxonomy + schema rules.
  for (const s of federal.seasons)
    validateEntry("federal", s, taxonomy, problems);
  for (const { file, data } of states) {
    if (typeof data.state !== "string" || data.state.length !== 2)
      problems.push(`${file}: missing 2-letter state code`);
    for (const s of data.seasons) validateEntry(file, s, taxonomy, problems);
  }

  // Merge each state and check the post-merge invariants.
  const splits = splitSpecies(taxonomy);
  for (const { data } of states) {
    const code = data.state ?? "??";
    const eff = merge(federal.seasons, data.seasons, taxonomy);

    if (eff.length !== new Set(eff.map((s) => s.key)).size)
      problems.push(`${code}: duplicate keys after merge`);
    for (const sp of splits) {
      if (eff.find((s) => s.key === sp))
        problems.push(
          `${code}: bare '${sp}' survived merge — whole→atom expansion failed`,
        );
    }
    for (const s of eff) {
      if (s.provenance !== "state" && s.provenance !== "federal")
        problems.push(`${code}: '${s.key}' missing provenance`);
    }
  }

  return problems;
}
