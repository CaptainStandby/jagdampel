import { useEffect, useMemo, useState, type JSX } from "react";
import type { SeasonMatrix } from "../lib/data.ts";
import type { StatusKind } from "../lib/status.ts";
import {
  GESAMT,
  perStateView,
  type MapSelection,
  type StateCell,
} from "../lib/mapStatus.ts";
import { SEARCH_PARAM } from "../lib/filters.ts";
import { href } from "../lib/paths.ts";
import { stateName } from "../lib/states.ts";
import { VIEW_BOX, STATES, CITY_CALLOUTS } from "../lib/geo/germany-states.ts";

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

interface ClassOption {
  classKey: string;
  label: string;
}

/** This species' class atoms, derived from the sliced rows (replaces speciesOptions). */
function classOptions(matrix: SeasonMatrix, speciesKey: string): ClassOption[] {
  return matrix.rows
    .filter((r) => r.speciesKey === speciesKey && r.key.includes("/"))
    .map((r) => ({
      classKey: r.key.split("/")[1],
      label: r.classLabel ?? r.key.split("/")[1],
    }));
}

function fillClass(cell: StateCell | undefined): string {
  if (!cell) return "fill-white";
  switch (cell.mode) {
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

/**
 * Choropleth of one species' status across the Bundesländer for "today". The
 * species is fixed by the page; only the class (for split species) is selectable.
 * Rendered client:only, so there is no SSR/hydration step — `now` is set on mount.
 */
export function GermanyMap({
  matrix,
  speciesKey,
}: {
  matrix: SeasonMatrix;
  speciesKey: string;
}): JSX.Element {
  const classes = useMemo(
    () => classOptions(matrix, speciesKey),
    [matrix, speciesKey],
  );
  const label = matrix.rows[0]?.speciesLabel ?? speciesKey;

  const [now, setNow] = useState<Date | null>(null);
  const [classKey, setClassKey] = useState<string>(
    classes.length > 0 ? GESAMT : "",
  );
  useEffect(() => setNow(new Date()), []);

  const selection: MapSelection = useMemo(
    () => ({
      speciesKey,
      classKey: classes.length > 0 ? classKey : null,
    }),
    [speciesKey, classKey, classes.length],
  );
  const view = useMemo(
    () => (now ? perStateView(matrix, selection, now) : null),
    [matrix, selection, now],
  );

  const hrefFor = (code: string): string =>
    href(`state/${code.toLowerCase()}`) +
    `?${new URLSearchParams({ [SEARCH_PARAM]: label })}`;

  return (
    <section aria-label={`Karte: ${label} je Bundesland`} className="space-y-4">
      {classes.length > 0 && (
        <div
          role="group"
          aria-label="Klasse wählen"
          className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 text-sm"
        >
          {classes.map((c) => (
            <button
              key={c.classKey}
              type="button"
              onClick={() => setClassKey(c.classKey)}
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
            onClick={() => setClassKey(GESAMT)}
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
        aria-label={`Karte: ${label} je Bundesland`}
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
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className={`${fillClass(cell)} stroke-gray-500 transition hover:stroke-jagd-forest hover:[stroke-width:3]`}
              />
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
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className="stroke-gray-500"
              />
              <circle
                cx={c.dot[0]}
                cy={c.dot[1]}
                r={16}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className={`${fillClass(cell)} stroke-gray-500 transition hover:stroke-jagd-forest hover:[stroke-width:3]`}
              />
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
        {classes.length > 0 && (
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
        )}
      </ul>

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
