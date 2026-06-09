# Interactive Germany Map (#39) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive Germany map to the homepage that selects a Bundesland and, driven by the existing category filter + a new searchable species picker, shows per-state counts or a per-species traffic-light — all computed live for *today*.

**Architecture:** A React island (`GermanyMap.tsx`) is fed the existing `buildMatrix()` data at build time and renders an inline SVG of the 16 Bundesländer (generated once from simplified GeoJSON). All "today"-dependent colour/count is computed in the browser after mount via a new pure module `mapStatus.ts`; the server render emits only the neutral, navigable outline so nothing stale is baked in. No new dependencies; `leaflet`/`@types/leaflet` have been removed (`@turf/*` kept for #38).

**Tech Stack:** Astro 6 (static), React 19 islands, Tailwind v4, Node 24 (TS type-stripping for `.mjs` test/generator scripts). Reuses `buildMatrix` (`src/lib/data.ts`), `computeStatus` (`src/lib/status.ts`), `CategoryFilter`/`filters.ts`, `paths.ts`.

**Conventions for every commit in this plan:**
- On branch `main`, commit messages have **no ticket prefix**.
- Every commit message ends with the footer line:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  (shown via a second `-m` in each commit step below).
- Husky + lint-staged auto-run prettier/eslint on staged files at commit time. Write clean code (no `any`, no unused vars).
- On-screen text is German; code/URL identifiers are English.

---

## File Structure

- **Create** `src/lib/mapStatus.ts` — pure logic: species picker options + per-state view (count / single / gesamt / absent). The only place the map's decision rules live. No DOM, `now` injected → node-testable.
- **Create** `scripts/test-mapstatus.mjs` — node unit tests for `mapStatus.ts` (same harness style as `scripts/test-status.mjs`).
- **Create** `scripts/build-germany-svg.mjs` — one-time generator: simplified GeoJSON → projected SVG path data. Pure Node, hand-rolled cos-corrected equirectangular projection, no deps.
- **Create** `data/geo/bundeslaender.geojson` — vendored simplified source GeoJSON (build input only; not shipped to client for #39).
- **Create** `src/lib/geo/germany-states.ts` — GENERATED output: `VIEW_BOX`, `STATES[]`, `CITY_CALLOUTS[]`. Committed.
- **Create** `src/components/GermanyMap.tsx` — the island: search + category chips + species list + class toggle + SVG map + legend + accessible text companion.
- **Modify** `src/pages/index.astro` — mount `GermanyMap` above the existing card grid (grid stays as fallback).
- **Modify** `package.json` — append `test-mapstatus` to the `test` script (no dependency changes).
- **Modify** `data/geo/README.md` — provenance + correct the Leaflet→SVG description.
- **Modify** `DESIGN_SPEC.md` — short homepage-map subsection.

Reused unchanged: `CategoryFilter.tsx`, `filters.ts`, `tags.ts`, `status.ts`, `data.ts`, `paths.ts`, `states.ts`, `global.css`.

---

## Task 1: Pure map-status logic (`mapStatus.ts`) — TDD

**Files:**
- Create: `src/lib/mapStatus.ts`
- Test: `scripts/test-mapstatus.mjs`
- Modify: `package.json` (test script)

- [ ] **Step 1: Write the failing test**

Create `scripts/test-mapstatus.mjs`:

```js
#!/usr/bin/env node
// Unit tests for src/lib/mapStatus.ts (the map's decision rules).
// Run from repo root:  node scripts/test-mapstatus.mjs   (or: npm test)
// Node 24 strips TS types, so we import the .ts module directly.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/mapStatus.ts")).href
);
const { speciesOptions, perStateView, GESAMT } = mod;

let failures = 0;
const stable = (v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? JSON.stringify(Object.fromEntries(Object.entries(v).sort()))
    : JSON.stringify(v);
function check(name, actual, expected) {
  const a = stable(actual);
  const e = stable(expected);
  if (a === e) console.log(`✓ ${name}`);
  else {
    failures++;
    console.error(`✗ ${name}\n    expected ${e}\n    actual   ${a}`);
  }
}

// --- synthetic matrix: 3 states, 3 species (one with classes) ---
const yr = (key) => ({ key, type: "year-round" });
const closed = (key) => ({ key, type: "closed" });
const range = (key, periods) => ({ key, type: "range", periods });

// states order: BY, SH, HH
const states = [
  { code: "BY", name: "Bayern" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "HH", name: "Hamburg" },
];
const rows = [
  {
    key: "wildschwein",
    speciesKey: "wildschwein",
    speciesLabel: "Wildschwein",
    classLabel: null,
    tags: ["schalenwild"],
    cells: [yr("wildschwein"), yr("wildschwein"), yr("wildschwein")],
  },
  {
    key: "feldhase",
    speciesKey: "feldhase",
    speciesLabel: "Feldhase",
    classLabel: null,
    tags: ["niederwild"],
    // open in June only in BY
    cells: [range("feldhase", [{ start: "06-01", end: "06-30" }]), closed("feldhase"), closed("feldhase")],
  },
  {
    key: "reh/bock",
    speciesKey: "reh",
    speciesLabel: "Rehwild",
    classLabel: "Rehbock",
    tags: ["schalenwild"],
    // open in June in BY; absent in SH and HH
    cells: [range("reh/bock", [{ start: "05-01", end: "01-31" }]), null, null],
  },
  {
    key: "reh/kitz",
    speciesKey: "reh",
    speciesLabel: "Rehwild",
    classLabel: "Kitz",
    tags: ["schalenwild"],
    // closed in June in BY and SH; absent in HH
    cells: [range("reh/kitz", [{ start: "09-01", end: "01-31" }]), closed("reh/kitz"), null],
  },
];
const matrix = { states, rows };
const JUNE = new Date("2026-06-15T12:00:00Z");
const sel = (over) => ({ tags: new Set(), speciesKey: null, classKey: null, ...over });

// --- speciesOptions ---
const opts = speciesOptions(matrix);
check("speciesOptions: sorted by German label", opts.map((o) => o.speciesKey), [
  "feldhase",
  "reh",
  "wildschwein",
]);
check("speciesOptions: classless has no classes", opts.find((o) => o.speciesKey === "wildschwein").classes, []);
check(
  "speciesOptions: reh exposes its classes",
  opts.find((o) => o.speciesKey === "reh").classes,
  [
    { classKey: "bock", label: "Rehbock" },
    { classKey: "kitz", label: "Kitz" },
  ],
);
check("speciesOptions: tags carried through", opts.find((o) => o.speciesKey === "feldhase").tags, ["niederwild"]);

// --- count mode (no tags): species count, not class atoms ---
const cAll = perStateView(matrix, sel(), JUNE);
check("count BY (ws+feldhase+reh)", cAll.get("BY"), { mode: "count", count: 3 });
check("count SH (ws only)", cAll.get("SH"), { mode: "count", count: 1 });
check("count HH (ws only)", cAll.get("HH"), { mode: "count", count: 1 });

// --- count mode with tag filter excludes feldhase (niederwild) ---
const cTag = perStateView(matrix, sel({ tags: new Set(["schalenwild"]) }), JUNE);
check("count BY schalenwild (ws+reh)", cTag.get("BY"), { mode: "count", count: 2 });
check("count SH schalenwild (ws)", cTag.get("SH"), { mode: "count", count: 1 });

// --- single mode: explicit class ---
const bock = perStateView(matrix, sel({ speciesKey: "reh", classKey: "bock" }), JUNE);
check("single bock BY open", bock.get("BY"), { mode: "single", status: "open" });
check("single bock SH absent", bock.get("SH"), { mode: "absent" });
check("single bock HH absent", bock.get("HH"), { mode: "absent" });

const kitz = perStateView(matrix, sel({ speciesKey: "reh", classKey: "kitz" }), JUNE);
check("single kitz BY closed", kitz.get("BY"), { mode: "single", status: "closed" });
check("single kitz HH absent", kitz.get("HH"), { mode: "absent" });

// --- single mode: classless species (classKey null) ---
const ws = perStateView(matrix, sel({ speciesKey: "wildschwein", classKey: null }), JUNE);
check("single classless wildschwein BY open", ws.get("BY"), { mode: "single", status: "open" });

// --- gesamt mode: aggregate classes ---
const ges = perStateView(matrix, sel({ speciesKey: "reh", classKey: GESAMT }), JUNE);
check("gesamt reh BY mixed (bock open, kitz closed)", ges.get("BY"), {
  mode: "gesamt",
  statuses: ["open", "closed"],
  mixed: true,
});
check("gesamt reh SH uniform closed", ges.get("SH"), {
  mode: "gesamt",
  statuses: ["closed"],
  mixed: false,
});
check("gesamt reh HH absent (all classes null)", ges.get("HH"), { mode: "absent" });

if (failures) {
  console.error(`\n✗ ${failures} test(s) failed`);
  process.exit(1);
}
console.log("\n✓ all mapStatus tests pass");
```

- [ ] **Step 2: Wire it into `npm test` and run to confirm it fails**

Edit `package.json`, change the `test` script:

```json
"test": "node scripts/test-status.mjs && node scripts/test-timeline.mjs && node scripts/test-mapstatus.mjs",
```

Run: `node scripts/test-mapstatus.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` / cannot import `src/lib/mapStatus.ts` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/mapStatus.ts`:

```ts
import { computeStatus, type StatusKind } from "./status";
import { matchesTags } from "./filters";
import type { MatrixRow, SeasonMatrix } from "./data";

/** Sentinel class value: aggregate all classes of a species. */
export const GESAMT = "gesamt";

/** One entry in the searchable species picker. */
export interface SpeciesOption {
  speciesKey: string;
  label: string;
  tags: string[];
  /** Empty for species the taxonomy does not split into classes. */
  classes: { classKey: string; label: string }[];
}

/** What drives the map: category chips (count mode) or a chosen species/class. */
export interface MapSelection {
  tags: ReadonlySet<string>;
  /** null → count mode. */
  speciesKey: string | null;
  /** A real classKey, GESAMT, or null (classless species / count mode). */
  classKey: string | null;
}

/** Per-state render instruction. */
export type StateCell =
  | { mode: "count"; count: number }
  | { mode: "single"; status: StatusKind }
  | { mode: "gesamt"; statuses: StatusKind[]; mixed: boolean }
  | { mode: "absent" };

const RANK: Record<StatusKind, number> = {
  open: 0,
  conditional: 1,
  soon: 2,
  closed: 3,
};
const HUNTABLE_NOW: ReadonlySet<StatusKind> = new Set(["open", "conditional"]);

function rowsBySpecies(matrix: SeasonMatrix): Map<string, MatrixRow[]> {
  const grouped = new Map<string, MatrixRow[]>();
  for (const row of matrix.rows) {
    const list = grouped.get(row.speciesKey) ?? [];
    list.push(row);
    grouped.set(row.speciesKey, list);
  }
  return grouped;
}

/** The species present in any state, with their classes — sorted for display. */
export function speciesOptions(matrix: SeasonMatrix): SpeciesOption[] {
  const options: SpeciesOption[] = [];
  for (const [speciesKey, rows] of rowsBySpecies(matrix)) {
    const classes = rows
      .filter((r) => r.key.includes("/"))
      .map((r) => ({
        classKey: r.key.split("/")[1],
        label: r.classLabel ?? r.key.split("/")[1],
      }));
    options.push({
      speciesKey,
      label: rows[0].speciesLabel,
      tags: rows[0].tags,
      classes,
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "de"));
}

function statusAt(row: MatrixRow, i: number, now: Date): StatusKind | null {
  const cell = row.cells[i];
  return cell ? computeStatus(cell, now).kind : null;
}

/**
 * The map's per-state instruction for a selection, computed for `now`.
 * Pure: `now` is injected so it is deterministic and node-testable.
 */
export function perStateView(
  matrix: SeasonMatrix,
  selection: MapSelection,
  now: Date,
): Map<string, StateCell> {
  const out = new Map<string, StateCell>();
  const grouped = rowsBySpecies(matrix);

  // Count mode — number of species (not class atoms) huntable today.
  if (!selection.speciesKey) {
    matrix.states.forEach((s, i) => {
      let count = 0;
      for (const rows of grouped.values()) {
        if (!matchesTags(rows[0].tags, selection.tags)) continue;
        const huntable = rows.some((r) => {
          const k = statusAt(r, i, now);
          return k !== null && HUNTABLE_NOW.has(k);
        });
        if (huntable) count += 1;
      }
      out.set(s.code, { mode: "count", count });
    });
    return out;
  }

  const rows = grouped.get(selection.speciesKey) ?? [];
  const classRows = rows.filter((r) => r.key.includes("/"));
  const wholeRow = rows.find((r) => !r.key.includes("/"));

  // Explicit single class.
  if (selection.classKey && selection.classKey !== GESAMT) {
    const row = classRows.find(
      (r) => r.key === `${selection.speciesKey}/${selection.classKey}`,
    );
    matrix.states.forEach((s, i) => {
      const k = row ? statusAt(row, i, now) : null;
      out.set(s.code, k ? { mode: "single", status: k } : { mode: "absent" });
    });
    return out;
  }

  // Classless species → its single whole row.
  if (wholeRow && classRows.length === 0) {
    matrix.states.forEach((s, i) => {
      const k = statusAt(wholeRow, i, now);
      out.set(s.code, k ? { mode: "single", status: k } : { mode: "absent" });
    });
    return out;
  }

  // Gesamt — aggregate the species' class rows per state.
  matrix.states.forEach((s, i) => {
    const kinds = classRows
      .map((r) => statusAt(r, i, now))
      .filter((k): k is StatusKind => k !== null);
    if (kinds.length === 0) {
      out.set(s.code, { mode: "absent" });
      return;
    }
    const unique = [...new Set(kinds)].sort((a, b) => RANK[a] - RANK[b]);
    out.set(s.code, { mode: "gesamt", statuses: unique, mixed: unique.length > 1 });
  });
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/test-mapstatus.mjs`
Expected: all `✓`, ends with `✓ all mapStatus tests pass`, exit 0.

- [ ] **Step 5: Confirm the full test suite + diagnostics are clean**

Run: `npm test`
Expected: all three test files pass.
Then run `mcp__ide__getDiagnostics` targeted at `src/lib/mapStatus.ts` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mapStatus.ts scripts/test-mapstatus.mjs package.json
git commit -m "feat: pure map-status logic for the Germany map" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Generate the SVG geometry (`germany-states.ts`)

No TDD (deterministic codegen); verification is structural (16 states, valid importable module).

**Files:**
- Create: `data/geo/bundeslaender.geojson`
- Create: `scripts/build-germany-svg.mjs`
- Create: `src/lib/geo/germany-states.ts` (generated)

- [ ] **Step 1: Vendor the source GeoJSON**

Run:

```bash
mkdir -p data/geo
curl -fsSL \
  "https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/2_bundeslaender/4_niedrig.geo.json" \
  -o data/geo/bundeslaender.geojson
node -e "const fs=require('node:fs');const g=JSON.parse(fs.readFileSync('data/geo/bundeslaender.geojson','utf8'));console.log(g.type,g.features.length,g.features[0].properties)"
```

Expected output: `FeatureCollection 16 { id: 'DE-BW', name: 'Baden-Württemberg', type: 'State' }`.
If the feature count is not 16 or `properties.id` is absent, STOP — do not proceed; the generator asserts these.

- [ ] **Step 2: Write the generator**

Create `scripts/build-germany-svg.mjs`:

```js
#!/usr/bin/env node
// Generate src/lib/geo/germany-states.ts from the simplified Bundesländer GeoJSON.
// Run once, and only when borders change:  node scripts/build-germany-svg.mjs
// Pure Node: a hand-rolled cos-corrected equirectangular projection, no deps.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SRC = join(process.cwd(), "data/geo/bundeslaender.geojson");
const OUT_DIR = join(process.cwd(), "src/lib/geo");
const OUT = join(OUT_DIR, "germany-states.ts");
const WIDTH = 1000; // base map width in SVG user units
const R = (n) => Math.round(n * 100) / 100;

const geo = JSON.parse(await readFile(SRC, "utf8"));
if (geo.type !== "FeatureCollection" || !Array.isArray(geo.features))
  throw new Error("source is not a FeatureCollection");
if (geo.features.length !== 16)
  throw new Error(`expected 16 Bundesländer, got ${geo.features.length}`);

const eachRing = (geom, fn) => {
  const polys =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : null;
  if (!polys) throw new Error("unexpected geometry: " + geom.type);
  for (const poly of polys) for (const ring of poly) fn(ring);
};

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const f of geo.features)
  eachRing(f.geometry, (ring) => {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  });

const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
const pxMin = minLon * cos;
const scale = WIDTH / (maxLon * cos - pxMin);
const projX = (lon) => R((lon * cos - pxMin) * scale);
const projY = (lat) => R((maxLat - lat) * scale); // north up
const HEIGHT = R((maxLat - minLat) * scale);

const codeOf = (f) => {
  const id = f.properties?.id ?? "";
  if (!/^DE-[A-Z]{2}$/.test(id)) throw new Error("bad feature id: " + id);
  return id.slice(3);
};

const pathD = (geom) => {
  let d = "";
  eachRing(geom, (ring) => {
    ring.forEach(([lon, lat], k) => {
      d += `${k === 0 ? "M" : "L"}${projX(lon)} ${projY(lat)} `;
    });
    d += "Z ";
  });
  return d.trim();
};

const bboxCenter = (geom) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  eachRing(geom, (ring) => {
    for (const [lon, lat] of ring) {
      const x = projX(lon), y = projY(lat);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  });
  return [R((x0 + x1) / 2), R((y0 + y1) / 2)];
};

const states = geo.features
  .map((f) => ({
    code: codeOf(f),
    d: pathD(f.geometry),
    labelPos: bboxCenter(f.geometry),
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

// City-state callouts in the right margin (top→down: BE, HH, HB).
const MARGIN = R(WIDTH * 0.18);
const VIEW_W = R(WIDTH + MARGIN);
const cityCallouts = ["BE", "HH", "HB"].map((code, idx) => {
  const st = states.find((s) => s.code === code);
  if (!st) throw new Error("missing city-state: " + code);
  return {
    code,
    dot: [R(WIDTH + MARGIN * 0.5), R(HEIGHT * (0.22 + idx * 0.18))],
    leaderTo: st.labelPos,
  };
});

const ts = `// GENERATED by scripts/build-germany-svg.mjs — do not edit by hand.
// Source: isellsoap/deutschlandGeoJSON (2_bundeslaender/4_niedrig). See data/geo/README.md.

export const VIEW_BOX = "0 0 ${VIEW_W} ${HEIGHT}";

export interface StatePath {
  code: string;
  d: string;
  labelPos: [number, number];
}
export const STATES: StatePath[] = ${JSON.stringify(states)};

export interface CityCallout {
  code: string;
  dot: [number, number];
  leaderTo: [number, number];
}
export const CITY_CALLOUTS: CityCallout[] = ${JSON.stringify(cityCallouts)};
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, ts);
console.log(`wrote ${OUT}: ${states.length} states, viewBox "0 0 ${VIEW_W} ${HEIGHT}"`);
```

- [ ] **Step 3: Run the generator**

Run: `node scripts/build-germany-svg.mjs`
Expected: `wrote .../src/lib/geo/germany-states.ts: 16 states, viewBox "0 0 <W> <H>"`.

- [ ] **Step 4: Smoke-check the generated module imports and is well-formed**

Run:

```bash
node -e "import(require('node:url').pathToFileURL('src/lib/geo/germany-states.ts').href).then(m=>{if(m.STATES.length!==16)throw new Error('not 16');if(!m.STATES.every(s=>s.d&&s.code))throw new Error('empty path');if(m.CITY_CALLOUTS.length!==3)throw new Error('callouts');console.log('ok',m.VIEW_BOX)})"
```

Expected: `ok 0 0 <W> <H>`.
Then run `mcp__ide__getDiagnostics` on `src/lib/geo/germany-states.ts` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add data/geo/bundeslaender.geojson scripts/build-germany-svg.mjs src/lib/geo/germany-states.ts
git commit -m "feat: generate inline SVG geometry for the Bundesländer" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The map island (`GermanyMap.tsx`) + homepage mount

The pure logic is already tested; this is the integration layer. Verify via build + diagnostics + manual dev.

**Files:**
- Create: `src/components/GermanyMap.tsx`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write the component**

Create `src/components/GermanyMap.tsx`:

```tsx
import { useEffect, useMemo, useState, type JSX } from "react";
import type { SeasonMatrix } from "../lib/data";
import type { StatusKind } from "../lib/status";
import {
  GESAMT,
  perStateView,
  speciesOptions,
  type MapSelection,
  type SpeciesOption,
  type StateCell,
} from "../lib/mapStatus";
import {
  applyParam,
  matchesTags,
  readTagsFromUrl,
  serializeTags,
  TAGS_PARAM,
} from "../lib/filters";
import { CategoryFilter } from "./CategoryFilter";
import { href } from "../lib/paths";
import { stateName } from "../lib/states";
import { VIEW_BOX, STATES, CITY_CALLOUTS } from "../lib/geo/germany-states";

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

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function resolveClass(species: SpeciesOption | null, raw: string | null): string | null {
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
      return cell.mixed ? "teils offen, teils Schonzeit" : STATUS_LABEL[cell.statuses[0]];
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
    // byKey is stable for a given matrix; intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const hrefFor = (code: string): string => {
    const t = serializeTags(tags);
    return href(`state/${code.toLowerCase()}`) + (t ? `?${TAGS_PARAM}=${t}` : "");
  };

  const q = normalize(search);
  const list = options.filter(
    (o) => matchesTags(o.tags, tags) && (q === "" || normalize(o.label).includes(q)),
  );

  const countMode = !speciesKey;

  return (
    <section aria-label="Jagdzeiten-Karte" className="space-y-4">
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Art suchen…"
          aria-label="Art suchen"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-jagd-forest focus:outline-none"
        />
        <CategoryFilter
          selected={tags}
          available={available}
          onToggle={toggleTag}
          onClear={() => setTags(new Set())}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
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
          {list.map((o) => (
            <button
              key={o.speciesKey}
              type="button"
              onClick={() => selectSpecies(o.speciesKey)}
              aria-pressed={o.speciesKey === speciesKey}
              className={`block w-full border-t border-gray-100 px-3 py-2 text-left text-sm ${
                o.speciesKey === speciesKey
                  ? "bg-jagd-forest/10 font-semibold text-jagd-forest"
                  : "hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">Keine Arten für diese Auswahl.</p>
          )}
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
            <a key={s.code} href={hrefFor(s.code)} aria-label={`${stateName(s.code)}: ${describe(cell)}`}>
              <path
                d={s.d}
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
            <a key={`callout-${c.code}`} href={hrefFor(c.code)} aria-label={`${stateName(c.code)}: ${describe(cell)}`}>
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
              <text x={c.dot[0]} y={c.dot[1] + 30} textAnchor="middle" className="fill-gray-600 text-[15px]">
                {c.code}
              </text>
            </a>
          );
        })}
      </svg>

      {countMode ? (
        <p className="text-sm text-gray-500">Zahl je Land: Arten mit Jagdzeit heute (🟢 + 🟠).</p>
      ) : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {(["open", "conditional", "soon", "closed"] as StatusKind[]).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${FILL[k].replace("fill-", "bg-")}`} aria-hidden />
              <span className="text-gray-600">{STATUS_LABEL[k]}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: "repeating-linear-gradient(45deg,#22c55e 0 3px,#ef4444 3px 6px)" }}
              aria-hidden
            />
            <span className="text-gray-600">kommt auf die Klasse an</span>
          </li>
        </ul>
      )}

      {view && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">Als Liste anzeigen</summary>
          <ul className="mt-2 divide-y divide-gray-100">
            {[...STATES]
              .map((s) => s.code)
              .sort((a, b) => stateName(a).localeCompare(stateName(b), "de"))
              .map((code) => (
                <li key={code} className="flex justify-between gap-3 py-1">
                  <a className="text-jagd-forest hover:underline" href={hrefFor(code)}>
                    {stateName(code)}
                  </a>
                  <span className="text-gray-600">{describe(view.get(code))}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount it on the homepage**

Edit `src/pages/index.astro`. Add to the frontmatter imports (after the existing imports):

```astro
import { availableStates, buildMatrix } from "../lib/data";
import { GermanyMap } from "../components/GermanyMap";
```

(Replace the existing `import { availableStates } from "../lib/data";` line with the combined import above.)

Add `const matrix = buildMatrix();` next to the existing `const available = ...` line.

Then insert the map block immediately **after** the closing `</p>` of the overview link (the paragraph containing "Übersicht aller Länder") and **before** the `<h2 ...>Bundesland wählen</h2>`:

```astro
    <section class="mt-8">
      <h2
        class="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase"
      >
        Auf der Karte
      </h2>
      <GermanyMap client:load matrix={matrix} />
    </section>
```

The existing "Bundesland wählen" card grid stays as-is below — it is the no-JS fallback.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: build succeeds; page count unchanged at **19**. No errors.

- [ ] **Step 4: Verify SSR output is navigable and not stale-baked**

Run:

```bash
grep -o 'href="/state/by[^"]*"' dist/index.html | head -1
grep -c 'viewBox' dist/index.html
grep -c 'fill-jagd-green\|>[0-9]</text>' dist/index.html || true
```

Expected: first command prints `href="/state/by"` (SSR map link present, no `/jagdampel` prefix, no stale tags). Second prints `1` (the SVG rendered server-side). Third should print `0` — confirming no today-dependent colours/counts were baked into SSR (they appear only after hydration).

- [ ] **Step 5: Diagnostics**

Run `mcp__ide__getDiagnostics` on `src/components/GermanyMap.tsx` and `src/pages/index.astro` — expect no errors.

- [ ] **Step 6: Manual dev check**

Run: `npm run dev`, open the homepage.
Confirm: the map shows count badges after load; selecting a category re-counts; picking "Wildschwein" turns states green/amber; picking "Rehwild" shows the class toggle and "Gesamt" yields split fills where classes disagree; clicking a state navigates to `/state/<code>` carrying `?tags=` when chips are active; the URL reflects `?species=`/`?class=`. Stop dev (Ctrl-C) when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/GermanyMap.tsx src/pages/index.astro
git commit -m "feat: interactive Germany map on the homepage (#39)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Docs + final verification

**Files:**
- Modify: `data/geo/README.md`
- Modify: `DESIGN_SPEC.md`

- [ ] **Step 1: Rewrite `data/geo/README.md`**

Replace its contents with:

```markdown
# GeoJSON for German federal state boundaries

`bundeslaender.geojson` is the simplified Bundesländer boundary set.

## Uses

1. **Build input for the homepage map.** `scripts/build-germany-svg.mjs` projects this file into
   `src/lib/geo/germany-states.ts` (committed SVG path data). The GeoJSON itself is **not** shipped to
   the client for the map — only the generated paths are.
2. **Geolocation → state** (planned, #38): point-in-polygon via `@turf/boolean-point-in-polygon`. That
   feature will ship the GeoJSON to the client; it is not used yet.

## Source & licence

- <https://github.com/isellsoap/deutschlandGeoJSON> — `2_bundeslaender/4_niedrig.geo.json`.
- Underlying data © GeoBasis-DE / BKG (Verwaltungsgebiete), dl-de/by-2-0. Confirm the upstream LICENSE
  before redistribution.

## Regenerating the SVG

```bash
node scripts/build-germany-svg.mjs
```

Each feature must expose its ISO code in `properties.id` (`DE-BY`, …); the generator asserts 16
features and a `DE-XX` id, and fails fast otherwise.

## Note

The map is plain inline SVG — no Leaflet. `leaflet`/`@types/leaflet` were removed from `package.json`.
`@turf/*` is kept for the planned geolocation feature (#38).
```

- [ ] **Step 2: Add a homepage-map note to `DESIGN_SPEC.md`**

Find the anchor:

```bash
grep -n "public/geo\|GeoJSON\|Übersicht aller\|## " DESIGN_SPEC.md | head -40
```

Add the following subsection in the most fitting place (near the pages/feature description; if unsure, append it as a new top-level section at the end of the file):

```markdown
## Homepage-Karte (#39)

Die Startseite zeigt eine interaktive Deutschlandkarte als primären Bundesland-Wähler; die Länder-Kachelliste
bleibt darunter als Fallback (und no-JS-Pfad).

- **Rendering:** Inline-SVG (server-gerendert, navigierbare `<a>`-Links ohne JS), generiert aus
  vereinfachtem Bundesländer-GeoJSON via `scripts/build-germany-svg.mjs` → `src/lib/geo/germany-states.ts`.
  Kein Leaflet zur Laufzeit. Stadtstaaten (HB, HH, BE) erhalten Callout-Marker am Rand.
- **Daten:** speist sich aus `buildMatrix()`; Status wird clientseitig für „heute" berechnet
  (`computeStatus`), nichts Datumsabhängiges wird ins SSR gebacken.
- **Modi:** Kategoriefilter → Anzahl jagdbarer Arten je Land (🟢 + 🟠); Auswahl einer Art →
  Ampel je Land; Art mit Klassen → Klassen-Umschalter, „Gesamt" nutzt eine Split-Füllung,
  wenn Klassen uneinheitlich sind. Klick auf ein Land öffnet `/state/<code>` mit aktivem `?tags=`.
- **Logik:** rein in `src/lib/mapStatus.ts`, getestet via `scripts/test-mapstatus.mjs`.
```

- [ ] **Step 3: Full verification gate**

Run, expecting all to pass cleanly:

```bash
npm test
npm run build
```

Expected: all tests pass; build succeeds with 19 pages.

- [ ] **Step 4: Commit**

```bash
git add data/geo/README.md DESIGN_SPEC.md
git commit -m "docs: document the homepage Germany map (#39)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- `npm test` green (including `test-mapstatus.mjs`).
- `npm run build` clean, 19 pages.
- Homepage shows the SVG map; counts/colours appear after load; class toggle + split fill work; states navigate carrying `?tags=`.
- `mcp__ide__getDiagnostics` clean on all new/modified source files.
- No new dependencies; `leaflet`/`@types/leaflet` removed, `@turf/*` kept for #38.
