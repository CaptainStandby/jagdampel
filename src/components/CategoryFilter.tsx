import type { JSX } from "react";
import { TAGS } from "../lib/tags";

/**
 * Toggle chips for the category tags. Selecting several shows species matching
 * ANY of them (union) — the natural reading of "show me Schalenwild and
 * Federwild". State is owned by the parent; this is presentational.
 */
export function CategoryFilter({
  selected,
  available,
  onToggle,
  onClear,
}: {
  selected: ReadonlySet<string>;
  available: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Kategorien filtern"
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {TAGS.filter((t) => available.has(t.key)).map((tag) => {
        const active = selected.has(tag.key);
        return (
          <button
            key={tag.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tag.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              active
                ? "border-jagd-forest bg-jagd-forest text-white"
                : "border-gray-300 text-gray-700 hover:border-jagd-forest"
            }`}
          >
            {tag.label}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-1 text-sm text-gray-500 underline hover:text-jagd-forest"
        >
          Zurücksetzen
        </button>
      )}
    </div>
  );
}
