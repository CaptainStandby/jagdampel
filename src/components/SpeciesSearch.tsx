import type { JSX } from "react";

/**
 * Shared species search box (diacritic-insensitive matching is done by the caller
 * via `matchesSearch` from lib/filters). Presentational — state lives in the parent.
 * Pass `className` to override the default bordered/rounded look (e.g. a seamless
 * header inside a combobox). A clear button appears on the right once there's text.
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
    <div className="relative w-full">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Art suchen…"
        aria-label="Art suchen"
        maxLength={100}
        className={`w-full px-3 py-2 pr-9 text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden ${className}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Suche löschen"
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-jagd-forest"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
