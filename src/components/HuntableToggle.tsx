import type { JSX } from "react";

/** Shared "hide all-year-closed species" checkbox, used on both filtered views. */
export function HuntableToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 accent-jagd-forest"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Nur jagdbare Arten (ganzjährig geschonte ausblenden)
    </label>
  );
}
