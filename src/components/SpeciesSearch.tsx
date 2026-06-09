import type { JSX } from "react";

/**
 * Shared species search box (diacritic-insensitive matching is done by the caller
 * via `matchesSearch` from lib/filters). Presentational — state lives in the parent.
 * Pass `className` to override the default bordered/rounded look (e.g. a seamless
 * header inside a combobox).
 */
export function SpeciesSearch({
  value,
  onChange,
  className = "rounded-lg border border-gray-300 focus:border-jagd-forest",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}): JSX.Element {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Art suchen…"
      aria-label="Art suchen"
      className={`w-full px-3 py-2 text-sm focus:outline-none ${className}`}
    />
  );
}
