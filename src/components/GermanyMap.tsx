import { useEffect, useMemo, useState, type JSX } from "react";
import type { SeasonMatrix } from "../lib/data.ts";
import type { StatusKind } from "../lib/status.ts";
import {
  GESAMT,
  perStateView,
  speciesOptions,
  type MapSelection,
  type SpeciesOption,
  type StateCell,
} from "../lib/mapStatus.ts";
import {
  applyParam,
  matchesSearch,
  matchesTags,
  readTagsFromUrl,
  serializeTags,
  TAGS_PARAM,
} from "../lib/filters.ts";
import { CategoryFilter } from "./CategoryFilter";
import { SpeciesSearch } from "./SpeciesSearch";
import { href } from "../lib/paths.ts";
import { stateName } from "../lib/states.ts";
import { VIEW_BOX, STATES, CITY_CALLOUTS } from "../lib/geo/germany-states.ts";

const SPECIES_PARAM = "species";
const CLASS_PARAM = "class";

const FILL: Record<StatusKind, string> = {
  open: "fill-jagd-green",
  conditional: "fill-jagd-amber",
  soon: "fill-jagd-yellow",
  closed: "fill-jagd-red",
};
const STATUS_LABEL: Record<StatusKind, string> = {
  open: "Jagdzeit",
  conditional: "mit Auflagen",
  soon: "bald",
  closed: "Schonzeit",
};

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function resolveClass(
  species: SpeciesOption | null,
  raw: string | null,
): string | null {
  if (!species || species.classes.length === 0) return null;
  if (raw && species.classes.some((c) => c.classKey === raw)) return raw;
  return GESAMT;
}

function fillClass(cell: StateCell | undefined): string {
  if (!cell) return "fill-white";
  switch (cell.mode) {
    case "count":
      return "fill-white";
    case "absent":
      return "fill-gray-200";
    case "single":
      return FILL[cell.status];
    case "gesamt":
      return cell.mixed ? "fill-[url(#mixed)]" : FILL[cell.statuses[0]];
  }
}

function describe(cell: StateCell | undefined): string {
  if (!cell) return "";
  switch (cell.mode) {
    case "count":
      return `${cell.count} ${cell.count === 1 ? "Art" : "Arten"} mit Jagdzeit heute`;
    case "single":
      return STATUS_LABEL[cell.status];
    case "gesamt":
      return cell.mixed
        ? "teils offen, teils Schonzeit"
        : STATUS_LABEL[cell.statuses[0]];
    case "absent":
      return "nicht im Jagdrecht";
  }
}

export function GermanyMap({ matrix }: { matrix: SeasonMatrix }): JSX.Element {
  const options = useMemo(() => speciesOptions(matrix), [matrix]);
  const byKey = useMemo(
    () => new Map(options.map((o) => [o.speciesKey, o])),
    [options],
  );
  const available = useMemo(() => {
    const s = new Set<string>();
    for (const o of options) for (const t of o.tags) s.add(t);
    return s;
  }, [options]);

  // SSR renders the neutral, navigable outline only — no today-dependent values.
  // State derived from the URL is applied after mount to avoid a hydration mismatch.
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [speciesKey, setSpeciesKey] = useState<string | null>(null);
  const [classRaw, setClassRaw] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const species = speciesKey ? (byKey.get(speciesKey) ?? null) : null;
  const classKey = resolveClass(species, classRaw);
  const selection: MapSelection = { tags, speciesKey, classKey };

  useEffect(() => {
    setTags(readTagsFromUrl());
    const sp = readParam(SPECIES_PARAM);
    setSpeciesKey(sp && byKey.has(sp) ? sp : null);
    setClassRaw(readParam(CLASS_PARAM));
    setNow(new Date());
    setReady(true);
    // Run once on mount: hydrate selection from the URL. byKey is stable per matrix.
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    applyParam(url, TAGS_PARAM, serializeTags(tags));
    applyParam(url, SPECIES_PARAM, speciesKey ?? "");
    applyParam(url, CLASS_PARAM, speciesKey && classKey ? classKey : "");
    window.history.replaceState(null, "", url);
  }, [ready, tags, speciesKey, classKey]);

  const view = now ? perStateView(matrix, selection, now) : null;

  const toggleTag = (key: string): void =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectSpecies = (key: string): void => {
    setSpeciesKey(key);
    setClassRaw(null); // resolves to GESAMT for species with classes
  };
  const clearSpecies = (): void => {
    setSpeciesKey(null);
    setClassRaw(null);
  };
  // Clicking the already-selected species deselects it (back to count mode).
  const toggleSpecies = (key: string): void =>
    key === speciesKey ? clearSpecies() : selectSpecies(key);

  const hrefFor = (code: string): string => {
    const t = serializeTags(tags);
    return (
      href(`state/${code.toLowerCase()}`) + (t ? `?${TAGS_PARAM}=${t}` : "")
    );
  };

  const filtered = options.filter(
    (o) => matchesTags(o.tags, tags) && matchesSearch(o.label, search),
  );
  // Keep the current selection visible (and deselectable) even when the active
  // filter/search would hide it — otherwise it stays selected with no way to undo.
  const selected = speciesKey ? byKey.get(speciesKey) : undefined;
  const list =
    selected && !filtered.some((o) => o.speciesKey === speciesKey)
      ? [selected, ...filtered]
      : filtered;

  const countMode = !speciesKey;

  return (
    <section aria-label="Jagdzeiten-Karte" className="space-y-4">
      <div className="space-y-3">
        <CategoryFilter
          selected={tags}
          available={available}
          onToggle={toggleTag}
          onClear={() => setTags(new Set())}
        />
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <SpeciesSearch
            value={search}
            onChange={setSearch}
            className="border-b border-gray-200 focus:border-jagd-forest"
          />
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={clearSpecies}
              aria-pressed={countMode}
              className={`block w-full px-3 py-2 text-left text-sm ${
                countMode ? "bg-jagd-forest text-white" : "hover:bg-gray-50"
              }`}
            >
              Alle Arten (Anzahl je Land)
            </button>
            {list.map((o) => {
              const isSelected = o.speciesKey === speciesKey;
              return (
                <button
                  key={o.speciesKey}
                  type="button"
                  onClick={() => toggleSpecies(o.speciesKey)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between border-t border-gray-100 px-3 py-2 text-left text-sm ${
                    isSelected
                      ? "bg-jagd-forest/10 font-semibold text-jagd-forest"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span>{o.label}</span>
                  {isSelected && (
                    <span aria-hidden className="text-jagd-forest">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-500">
                Keine Arten für diese Auswahl.
              </p>
            )}
          </div>
        </div>
      </div>

      {species && species.classes.length > 0 && (
        <div
          role="group"
          aria-label="Klasse wählen"
          className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 text-sm"
        >
          {species.classes.map((c) => (
            <button
              key={c.classKey}
              type="button"
              onClick={() => setClassRaw(c.classKey)}
              aria-pressed={classKey === c.classKey}
              className={`rounded-md px-3 py-1 font-medium ${
                classKey === c.classKey
                  ? "bg-jagd-forest text-white"
                  : "text-gray-600 hover:text-jagd-forest"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setClassRaw(GESAMT)}
            aria-pressed={classKey === GESAMT}
            className={`rounded-md px-3 py-1 font-medium ${
              classKey === GESAMT
                ? "bg-jagd-forest text-white"
                : "text-gray-600 hover:text-jagd-forest"
            }`}
          >
            Gesamt
          </button>
        </div>
      )}

      <svg
        viewBox={VIEW_BOX}
        className="h-auto w-full"
        role="img"
        aria-label={
          countMode
            ? "Karte: Anzahl jagdbarer Arten je Bundesland"
            : `Karte: ${species?.label ?? ""} je Bundesland`
        }
      >
        <defs>
          <pattern
            id="mixed"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#22c55e" />
            <rect width="4" height="8" fill="#ef4444" />
          </pattern>
        </defs>

        {STATES.map((s) => {
          const cell = view?.get(s.code);
          return (
            <a
              key={s.code}
              href={hrefFor(s.code)}
              aria-label={`${stateName(s.code)}: ${describe(cell)}`}
            >
              <path
                d={s.d}
                fillRule="evenodd"
                strokeWidth={1}
                className={`${fillClass(cell)} stroke-gray-300 transition hover:stroke-jagd-forest`}
              />
              {cell?.mode === "count" && cell.count > 0 && (
                <text
                  x={s.labelPos[0]}
                  y={s.labelPos[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                  className="fill-jagd-forest text-[22px] font-bold"
                >
                  {cell.count}
                </text>
              )}
            </a>
          );
        })}

        {CITY_CALLOUTS.map((c) => {
          const cell = view?.get(c.code);
          return (
            <a
              key={`callout-${c.code}`}
              href={hrefFor(c.code)}
              aria-label={`${stateName(c.code)}: ${describe(cell)}`}
            >
              <line
                x1={c.leaderTo[0]}
                y1={c.leaderTo[1]}
                x2={c.dot[0]}
                y2={c.dot[1]}
                strokeWidth={1}
                className="stroke-gray-400"
              />
              <circle
                cx={c.dot[0]}
                cy={c.dot[1]}
                r={16}
                strokeWidth={1}
                className={`${fillClass(cell)} stroke-gray-400 transition hover:stroke-jagd-forest`}
              />
              {cell?.mode === "count" && cell.count > 0 && (
                <text
                  x={c.dot[0]}
                  y={c.dot[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                  className="fill-jagd-forest text-[16px] font-bold"
                >
                  {cell.count}
                </text>
              )}
              <text
                x={c.dot[0]}
                y={c.dot[1] + 30}
                textAnchor="middle"
                className="fill-gray-600 text-[15px]"
              >
                {c.code}
              </text>
            </a>
          );
        })}
      </svg>

      {countMode ? (
        <p className="text-sm text-gray-500">
          Zahl je Land: Arten mit Jagdzeit heute (🟢 + 🟠).
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {(["open", "conditional", "soon", "closed"] as StatusKind[]).map(
            (k) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${FILL[k].replace("fill-", "bg-")}`}
                  aria-hidden
                />
                <span className="text-gray-600">{STATUS_LABEL[k]}</span>
              </li>
            ),
          )}
          <li className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                background:
                  "repeating-linear-gradient(45deg,#22c55e 0 3px,#ef4444 3px 6px)",
              }}
              aria-hidden
            />
            <span className="text-gray-600">kommt auf die Klasse an</span>
          </li>
        </ul>
      )}

      {view && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">
            Als Liste anzeigen
          </summary>
          <ul className="mt-2 divide-y divide-gray-100">
            {[...STATES]
              .map((s) => s.code)
              .sort((a, b) => stateName(a).localeCompare(stateName(b), "de"))
              .map((code) => (
                <li key={code} className="flex justify-between gap-3 py-1">
                  <a
                    className="text-jagd-forest hover:underline"
                    href={hrefFor(code)}
                  >
                    {stateName(code)}
                  </a>
                  <span className="text-gray-600">
                    {describe(view.get(code))}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
