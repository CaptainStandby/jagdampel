import { TAG_KEYS, TAGS } from "./tags";

// Shared URL-param + filtering helpers used by both the per-state view and the
// overview, so the two filters stay identical. Tag values are serialized in the
// canonical TAGS order for stable, shareable URLs.
export const TAGS_PARAM = "tags";
export const HUNTABLE_PARAM = "huntable";

export function readTagsFromUrl(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = new URLSearchParams(window.location.search).get(TAGS_PARAM) ?? "";
  return new Set(raw.split(",").filter((key) => TAG_KEYS.has(key)));
}

export function serializeTags(tags: ReadonlySet<string>): string {
  return TAGS.filter((t) => tags.has(t.key))
    .map((t) => t.key)
    .join(",");
}

export function readBoolFromUrl(param: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(param) === "1";
}

/** Set a search param to a non-empty value, or remove it when empty. */
export function applyParam(url: URL, param: string, value: string): void {
  if (value) url.searchParams.set(param, value);
  else url.searchParams.delete(param);
}

/** Union/OR match: no selection means everything passes. */
export function matchesTags(
  itemTags: readonly string[],
  selected: ReadonlySet<string>,
): boolean {
  return selected.size === 0 || itemTags.some((t) => selected.has(t));
}
