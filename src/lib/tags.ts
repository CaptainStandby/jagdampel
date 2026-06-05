/**
 * The category tags a species can carry, in display order. Used to filter the
 * per-state view. Tags are German hunting categories (no clean English term, like
 * the state codes); the values live here as the single source for both the filter
 * UI and the data verifier. Hoch-/Niederwild is a traditional, not legal,
 * classification — see DESIGN_SPEC §10.
 */
export interface TagDef {
  key: string;
  label: string;
}

export const TAGS: readonly TagDef[] = [
  { key: "schalenwild", label: "Schalenwild" },
  { key: "hochwild", label: "Hochwild" },
  { key: "niederwild", label: "Niederwild" },
  { key: "raubwild", label: "Raubwild" },
  { key: "haarwild", label: "Haarwild" },
  { key: "federwild", label: "Federwild" },
  { key: "wasserwild", label: "Wasserwild" },
  { key: "rabenwild", label: "Rabenwild" },
  { key: "greifvoegel", label: "Greifvögel" },
  { key: "neozoen", label: "Neozoen" },
];

export const TAG_KEYS: ReadonlySet<string> = new Set(TAGS.map((t) => t.key));
