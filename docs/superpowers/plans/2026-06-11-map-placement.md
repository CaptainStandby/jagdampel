# Map Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the overview matrix the home page and move the GermanyMap onto species detail pages (pinned to that species), removing `/overview` and the map's now-dead count-mode/picker.

**Architecture:** The home route renders the existing `SeasonMatrix` (the cross-state table/cards) with the static state grid kept below as no-JS nav. Each species page renders `GermanyMap` fed a **slim per-species `SeasonMatrix` slice** (`speciesMatrix(key)`) so `perStateView` works unchanged with a tiny props payload. `GermanyMap` is refactored to a fixed-species map and `mapStatus`'s count branch / `speciesOptions` are deleted.

**Tech Stack:** Astro 6 (`output: 'static'`), React 19 islands (`client:only`), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-11-map-placement-design.md`

**Project conventions:** Pure lib code is TDD'd with Vitest (`src/lib/*.test.ts`); React components and `.astro` pages are **build-gated** (no component tests) — their "test" is `tsc` + `npm run build` + a manual check. Commits land on `main`, no ticket prefix, footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. `npm test` = `vitest run`.

---

## File Structure

- **Modify** `src/lib/data.ts` — add `speciesMatrix(speciesKey)` (slim slice of `buildMatrix()`).
- **Modify** `src/lib/data.test.ts` — test `speciesMatrix`.
- **Modify** `src/pages/index.astro` — home becomes the matrix + state grid + upcoming.
- **Delete** `src/pages/overview.astro` — route removed.
- **Modify** `src/lib/mapStatus.ts` — drop count branch, `StateCell.count`, `speciesOptions`/`SpeciesOption`, `MapSelection.tags`, unused `matchesTags` import.
- **Modify** `src/lib/mapStatus.test.ts` — drop count + `speciesOptions` cases.
- **Rewrite** `src/components/GermanyMap.tsx` — fixed-species map.
- **Modify** `src/pages/species/[slug].astro` — mount the map.
- **Modify** `DESIGN_SPEC.md` — §6/§7/§9.

Task order keeps the build green at every commit: T1 is additive; T2 removes the map's only caller (home) so the old map is orphaned-but-valid; T3 rewrites the map + `mapStatus` together (their type coupling forces one commit) and wires the species page; T4 is docs + final verification.

---

## Task 1: `speciesMatrix` data slice

**Files:**
- Modify: `src/lib/data.ts` (add after `buildMatrix`)
- Test: `src/lib/data.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/data.test.ts`. Update the existing import line to include `speciesMatrix`:
```ts
import {
  availableStates,
  availableSpecies,
  getStateSeasons,
  getSpeciesDetail,
  speciesMatrix,
} from "./data";
```
Append this block:
```ts
describe("speciesMatrix", () => {
  it("returns all states and only the requested species' rows", () => {
    const m = speciesMatrix("schwarzwild");
    expect(m.states).toEqual(availableStates());
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows.every((r) => r.speciesKey === "schwarzwild")).toBe(true);
  });

  it("unknown species → no rows but full state list", () => {
    const m = speciesMatrix("not-a-real-species");
    expect(m.rows).toEqual([]);
    expect(m.states.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data.test.ts`
Expected: FAIL — `speciesMatrix is not a function` (not exported yet).

- [ ] **Step 3: Implement `speciesMatrix`**

In `src/lib/data.ts`, immediately after the `buildMatrix()` function, add:
```ts
/**
 * The overview matrix sliced to a single species — its rows (the whole-species
 * row and/or class atoms) across all states. A valid SeasonMatrix, so
 * perStateView consumes it unchanged; slim enough to serialize into a species
 * page's island props without shipping the full matrix.
 */
export function speciesMatrix(speciesKey: string): SeasonMatrix {
  const full = buildMatrix();
  return {
    states: full.states,
    rows: full.rows.filter((r) => r.speciesKey === speciesKey),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/data.test.ts`
Expected: PASS (all `data` cases green, including the 2 new ones).

- [ ] **Step 5: Type-check and commit**

Run: `npx --no-install tsc --noEmit` → clean.
```bash
git add src/lib/data.ts src/lib/data.test.ts
git commit -m "$(cat <<'EOF'
feat: add speciesMatrix slice for per-species map (#72)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Home = overview matrix; remove `/overview`

**Files:**
- Modify: `src/pages/index.astro` (full rewrite of the frontmatter + `<main>`)
- Delete: `src/pages/overview.astro`

No unit test (Astro page — build-gated).

- [ ] **Step 1: Rewrite `src/pages/index.astro`**

Replace the entire file with:
```astro
---
import Layout from "../layouts/Layout.astro";
import Disclaimer from "../components/Disclaimer.astro";
import { SeasonMatrix } from "../components/SeasonMatrix";
import { availableStates, buildMatrix } from "../lib/data";
import { BUNDESLAENDER } from "../lib/states";
import { href } from "../lib/paths";

const available = availableStates();
const matrix = buildMatrix();
const availableCodes = new Set(available.map((s) => s.code));
const upcoming = Object.entries(BUNDESLAENDER)
  .filter(([code]) => !availableCodes.has(code))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "de"));
---

<Layout title="Jagdampel – Jagdzeiten auf einen Blick">
  <main class="container mx-auto max-w-5xl p-4">
    <h1 class="text-4xl font-bold text-jagd-forest">Jagdampel</h1>
    <p class="mt-2 text-lg text-gray-700">
      Welche Wildart hat in deinem Bundesland gerade Jagdzeit? Im Überblick – oder
      ein Bundesland wählen.
    </p>

    <section class="mt-8">
      <SeasonMatrix client:only="react" matrix={matrix} />
      <noscript>
        <p class="text-sm text-gray-600">
          Die Übersichtstabelle benötigt JavaScript. Ohne JavaScript unten ein
          Bundesland wählen.
        </p>
      </noscript>
    </section>

    <h2
      class="mt-8 mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase"
    >
      Bundesland wählen
    </h2>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {
        available.map((s) => (
          <li>
            <a
              href={href(`state/${s.code.toLowerCase()}`)}
              class="block rounded-lg border border-gray-200 bg-white p-4 text-lg font-semibold text-jagd-forest shadow-sm transition hover:border-jagd-green hover:shadow"
            >
              {s.name}
            </a>
          </li>
        ))
      }
    </ul>

    {
      upcoming.length > 0 && (
        <>
          <h2 class="mt-8 mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Bald verfügbar
          </h2>
          <ul class="flex flex-wrap gap-2">
            {upcoming.map((s) => (
              <li class="cursor-not-allowed rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400">
                {s.name}
              </li>
            ))}
          </ul>
        </>
      )
    }

    <Disclaimer />
  </main>
</Layout>
```
Changes vs current: drops the `GermanyMap` import/section and the `→ Übersicht` link; imports + renders `SeasonMatrix`; widens `max-w-2xl` → `max-w-5xl` for the table.

- [ ] **Step 2: Delete the overview route**

Run: `git rm src/pages/overview.astro`

- [ ] **Step 3: Verify no dangling references**

Run: `grep -rn "href(\"overview\")\|pages/overview\|/overview" src/`
Expected: no matches (comment mentions of the word "overview" in `data.ts`/`status.ts`/`filters.ts` are about the concept and are fine; the grep above is specific to the route/link).

- [ ] **Step 4: Build and verify page count + green**

Run: `npx --no-install tsc --noEmit && npm run build`
Expected: tsc clean; build reports **105 page(s)** (was 106 — overview removed).

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open `/`.
Expected: the month-selectable overview matrix renders as the lead content; the 16-state grid and "Bald verfügbar" sit below it; no map; the `→ Übersicht` link is gone. With JS disabled, the state grid is still usable. Stop dev when done.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro
git rm src/pages/overview.astro
git commit -m "$(cat <<'EOF'
feat: make the overview matrix the home page, remove /overview (#72)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fixed-species GermanyMap + mapStatus cleanup + species-page mount

These land together: removing `StateCell.count` makes the old map's `switch`es non-exhaustive (a tsc error), and the old map is `mapStatus`'s only user of count-mode/`speciesOptions`. One commit keeps the build green.

**Files:**
- Modify: `src/lib/mapStatus.test.ts` (drop count + speciesOptions cases)
- Modify: `src/lib/mapStatus.ts` (drop count branch, `StateCell.count`, `speciesOptions`/`SpeciesOption`, `MapSelection.tags`, `matchesTags` import)
- Rewrite: `src/components/GermanyMap.tsx`
- Modify: `src/pages/species/[slug].astro`

- [ ] **Step 1: Trim `mapStatus.test.ts` to the surviving modes**

In `src/lib/mapStatus.test.ts`: change the **value** import to drop `speciesOptions` (leave the separate `import type { MapSelection } from "./mapStatus";` line and the `./data` / `./seasons` type imports untouched):
```ts
import { perStateView, GESAMT } from "./mapStatus";
```
Update the `sel` helper to drop `tags` (count-only):
```ts
const sel = (over: Partial<MapSelection> = {}): MapSelection => ({
  speciesKey: null,
  classKey: null,
  ...over,
});
```
Delete these three `describe` blocks entirely: **"speciesOptions"**, **"perStateView: count mode (no tags)"**, and **"perStateView: count mode with tag filter"**. Keep the fixture (`states`, `rows`, `yr`/`closed`/`range`, `JUNE`) and the three surviving blocks: **single mode (explicit class)**, **single mode (classless species)**, **gesamt mode**.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/mapStatus.test.ts`
Expected: FAIL — TypeScript/usage errors because `MapSelection` still has `tags` (the `sel` helper no longer sets it) and the source still exports the now-untested shape. (It is fine if it instead still passes here; the real gate is Step 4 after the source is trimmed. Proceed to Step 3 either way.)

- [ ] **Step 3: Trim `mapStatus.ts`**

Apply these edits to `src/lib/mapStatus.ts`:

a) Remove the now-unused import (line 2):
```ts
// DELETE this line:
import { matchesTags } from "./filters.ts";
```

b) Delete the `SpeciesOption` interface and the `speciesOptions` function entirely (the `SpeciesOption` interface block and the whole `export function speciesOptions(...) { ... }`).

c) In `MapSelection`, remove the `tags` field so it reads:
```ts
/** What drives the map: a chosen species/class. */
export interface MapSelection {
  /** The species to show. */
  speciesKey: string | null;
  /** A real classKey, GESAMT, or null (classless species). */
  classKey: string | null;
}
```

d) In `StateCell`, delete the `count` variant so it reads:
```ts
export type StateCell =
  | { mode: "single"; status: StatusKind }
  | { mode: "gesamt"; statuses: StatusKind[]; mixed: boolean }
  | { mode: "absent" };
```

e) Delete the `HUNTABLE_NOW` const (e.g. `const HUNTABLE_NOW: ReadonlySet<StatusKind> = new Set(["open", "conditional"]);`) — it was used only by the count branch and will otherwise be an unused-var lint error. Keep `RANK` (still used by gesamt).

f) In `perStateView`, delete the entire count-mode block — the `if (!selection.speciesKey) { ... return out; }` section (the loop that builds `{ mode: "count", count }`). The function body now begins directly with:
```ts
  const out = new Map<string, StateCell>();
  const grouped = rowsBySpecies(matrix);

  const rows = grouped.get(selection.speciesKey ?? "") ?? [];
  const classRows = rows.filter((r) => r.key.includes("/"));
  const wholeRow = rows.find((r) => !r.key.includes("/"));
  // ... rest unchanged (explicit single class / classless / gesamt) ...
```
(Only the leading count block and its use of `matchesTags` are removed; the single/classless/gesamt logic below is untouched.)

- [ ] **Step 4: Run the mapStatus test to verify it passes**

Run: `npx vitest run src/lib/mapStatus.test.ts`
Expected: PASS (single / classless / gesamt cases).

- [ ] **Step 5: Rewrite `src/components/GermanyMap.tsx`**

Replace the entire file with:
```tsx
import { useEffect, useState, type JSX } from "react";
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
  const classes = classOptions(matrix, speciesKey);
  const label = matrix.rows[0]?.speciesLabel ?? speciesKey;

  const [now, setNow] = useState<Date | null>(null);
  const [classKey, setClassKey] = useState<string>(
    classes.length > 0 ? GESAMT : "",
  );
  useEffect(() => setNow(new Date()), []);

  const selection: MapSelection = {
    speciesKey,
    classKey: classes.length > 0 ? classKey : null,
  };
  const view = now ? perStateView(matrix, selection, now) : null;

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
        {(["open", "conditional", "soon", "closed"] as StatusKind[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${FILL[k].replace("fill-", "bg-")}`}
              aria-hidden
            />
            <span className="text-gray-600">{STATUS_LABEL[k]}</span>
          </li>
        ))}
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
```

- [ ] **Step 6: Mount the map on the species page**

In `src/pages/species/[slug].astro`: add `GermanyMap` + `speciesMatrix` to the imports:
```ts
import { GermanyMap } from "../../components/GermanyMap";
import { availableSpecies, getSpeciesDetail, speciesMatrix } from "../../lib/data";
```
Then, between the closing `}` of the tag-chips `{ tagLabels.length > 0 && ( ... ) }` block and the `<div class="mt-6">` that holds `SpeciesStateList`, insert:
```astro
    <section class="mt-6">
      <GermanyMap client:only="react" matrix={speciesMatrix(key)} speciesKey={key} />
    </section>
```
Leave the existing `SpeciesStateList` `<div>` and its `<noscript>` fallback unchanged.

- [ ] **Step 7: Type-check, full suite, build**

Run: `npx --no-install tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all suites green (mapStatus now has the trimmed case set); build **105 pages**.

- [ ] **Step 8: Manual check**

Run: `npm run dev`. Open `/species/schwarzwild` (classless) and `/species/reh` (split → class toggle).
Expected: map shows that species' status per Bundesland for today; `reh` shows a class toggle (Rehbock/…/Gesamt) that recolours the map; clicking a state goes to `/state/<code>?q=<species label>`; the open-first list still renders below. The home `/` is unaffected.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mapStatus.ts src/lib/mapStatus.test.ts src/components/GermanyMap.tsx src/pages/species/[slug].astro
git commit -m "$(cat <<'EOF'
feat: pin GermanyMap to species pages, drop count-mode (#72)

GermanyMap becomes a fixed-species choropleth fed a slim speciesMatrix
slice; the species picker, count mode, category filter, and URL state are
removed (class toggle kept, derived from the rows). mapStatus loses the
count branch, StateCell.count, speciesOptions, and MapSelection.tags.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Docs + final verification

**Files:**
- Modify: `DESIGN_SPEC.md` (§6 IA, §7 components, §9 status/date)

- [ ] **Step 1: Update DESIGN_SPEC §6 (information architecture)**

Find the §6 description of routes and make it state: `/` is the overview (the `SeasonMatrix` cross-state table) plus the state picker; `/state/<code>` per-state list; `/species/<key>` one species across states **with the GermanyMap**. Remove any claim that `/` is a map/landing or that `/overview` exists.

- [ ] **Step 2: Update DESIGN_SPEC §7 (components)**

- `GermanyMap`: now a **fixed-species** choropleth on the species pages (props `{ matrix, speciesKey }`, fed `speciesMatrix(key)`); class toggle only; no count mode / picker.
- `SeasonMatrix`: note it is the **home** page's lead component (was `/overview`).
- Add `speciesMatrix(key)` to the `data.ts` helper list.

- [ ] **Step 3: Update DESIGN_SPEC §9 (current status)**

Set the date line to `2026-06-11`. Move #72 to done: "overview matrix is the home page; GermanyMap moved onto species pages; `/overview` removed; map count-mode/picker dropped." Update the page count to **105**.

- [ ] **Step 4: Final verification gate**

Run:
```bash
npx prettier --check DESIGN_SPEC.md
npm run lint
npx --no-install tsc --noEmit
npm test
npm run build
```
Expected: prettier clean (run `npx prettier --write DESIGN_SPEC.md` if not); lint clean; tsc clean; full suite green; build **105 pages**. Also confirm the verifier still runs: `node .claude/skills/jagdzeiten-import/scripts/verify-import.mjs` → "✓ all checks pass".

- [ ] **Step 5: Commit**

```bash
git add DESIGN_SPEC.md
git commit -m "$(cat <<'EOF'
docs: overview-as-home + map-on-species in DESIGN_SPEC (#72)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final review

After all tasks: dispatch a code-review of the full `#72` diff (home, map, mapStatus, species page) — focus on the payload of `speciesMatrix` (slim slice, no full-matrix leak into species pages), the map's `client:only` render path, and that no dead `count`/`speciesOptions`/`tags` references remain. Then use superpowers:finishing-a-development-branch.
