# Interactive Germany map (#39) — design

Status: approved 2026-06-09. Supersedes the "choropleth + Leaflet" sketch in `public/geo/README.md`.

## Problem

Jagdampel answers "what has Jagdzeit right now in my Bundesland?" Today the only entry point is a
flat list of 16 state cards. A map is a more intuitive chooser — and, with the category filter wired
in, it can also answer the spatial question hunters actually ask: **"where is _this_ species open
right now?"**

The trap a naïve choropleth falls into: there is no honest single colour for a whole state, because
status is per species (and per _class_ within a species — Rehbock and Kitz have different seasons).
Colouring a state one colour by some aggregate manufactures false confidence, which is exactly what
this project's disclaimer-heavy design fights. The design below keeps every coloured/numbered state
**precisely meaningful**.

## Decisions (locked)

| Question             | Decision                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Map's job            | Clickable selector **and** filter-driven data view (not a standalone choropleth).                       |
| Filter integration   | Category chips → per-state **count**; narrow to one Art → per-state **traffic-light**.                  |
| Species selector     | Searchable (text) species list, narrowed by the existing category chips.                                |
| Classes of a species | Pick species → segmented class toggle `[…classes…                                                       | Gesamt]`, default **Gesamt**. Species without classes select directly (no toggle). |
| Map shape            | **Geographic outline** (real borders); city-states get labelled callout markers.                        |
| Placement            | **Homepage, primary chooser**; existing card list kept below as fallback.                               |
| Geolocation (#38)    | **Deferred.** Build the map now without it; they share only the GeoJSON asset.                          |
| Rendering tech       | **Inline SVG**, server-rendered. **Not Leaflet** — drop the runtime dependency.                         |
| Count semantics      | A species counts when huntable today: 🟢 Jagdzeit **+** 🟠 mit Auflagen. 🟡 bald / 🔴 Schonzeit do not. |
| State click          | Navigate to `/state/<code>`, carrying the active `?tags=`.                                              |
| No-filter landing    | Count mode active by default ("N Arten mit Jagdzeit heute" per state).                                  |

## Architecture & data flow

The map is a **client island fed by one build-time data structure**. Live status depends on "today",
and the codebase already computes status client-side (`client:only` islands, `computeStatus(season,
new Date())`), so the map follows the same pattern.

- **Data feed:** reuse `buildMatrix()` (`src/lib/data.ts`) verbatim. It yields `{ states[], rows[] }`,
  each row a species/class key (`rotwild/hirsch`) with one `Season | null` cell per state, all-null
  rows dropped, taxonomy-ordered. This is exactly the map's input — no new merge/data code.
- The island receives the matrix as a prop (inlined into the static HTML at build), then derives
  colours/counts in the browser. The only "today"-dependent computation is `computeStatus`, run
  client-side, so the map is always correct regardless of build time.

## The SVG asset (geographic outline)

- **Source:** simplified Bundesländer GeoJSON from isellsoap `deutschlandGeoJSON` (the source named in
  `public/geo/README.md`). Committed to the repo under `data/geo/` as a **build input only** — not
  shipped to the client for #39. Each feature must expose the two-letter code; normalise on load.
- **Generator:** a one-time script `scripts/build-germany-svg.mjs` projects the GeoJSON (Mercator at
  this scale is fine) into `src/lib/geo/germany-states.ts`:
  ```ts
  export const VIEW_BOX = "0 0 W H";
  export const STATES: {
    code: string;
    d: string;
    labelPos: [number, number];
  }[];
  export const CITY_CALLOUTS: {
    code: string;
    dot: [number, number];
    leaderTo: [number, number];
  }[];
  ```
  Output is committed; the script is re-run only if borders change (≈never). Provenance + licence
  recorded in `data/geo/README.md`.
- **City-states** (HB, HH, BE): drawn as their real (small) polygons **plus** a labelled callout
  marker — a dot with the code and a thin leader line in margin space — so they remain easy click
  targets. Standard German election-map treatment.

## Components & picker UI

One island, `src/components/GermanyMap.tsx`, composed of small focused pieces, reusing what exists:

- **Category chips** — reuse `CategoryFilter.tsx` + `filters.ts` (`?tags=` URL sync) unchanged.
- **Search input** — new; filters the species list by label, diacritic-insensitive (so "gans" matches
  "Graugänse", "loffel" matches "Löffelente"). Normalise via
  `s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()`.
- **Species list** — species present in any state, narrowed by chips (tag union match) + search.
  Clicking a species:
  - _no classes_ → selects it directly → traffic-light mode.
  - _has classes_ → reveals a segmented toggle `[class… | Gesamt]`, default **Gesamt**.
- **SVG map** + **legend** + an **accessible text companion**: because map fills are colour-only, a
  list of states with their status in words is rendered below the map (and used as the noscript view).
  This preserves the project's rule that colour is never the only signal (see `SeasonStatusBadge`).

URL params: existing `?tags=` for chips; add `?species=<speciesKey>` and (when applicable)
`?class=<classKey|gesamt>` so a selection is shareable, mirroring the `filters.ts` serialisation
style. Param keys stay English like the rest of the codebase's URLs/identifiers; only on-screen text
is German. Selection state lives in the island; URL is the source of truth on load.

## Render modes (client-side, live for today)

1. **Count mode** — no single species selected. Each state's badge = number of species (filtered by
   active chips) huntable today (🟢 + 🟠). No chips selected → count over all present species. Label:
   "N Arten mit Jagdzeit heute".
2. **Traffic-light mode** — one species (classless) or one class selected. Each state filled by that
   key's `computeStatus` today: green (open) / amber (conditional) / yellow (soon) / red (closed).
   Species absent from a state's Jagdrecht (cell `null`) → neutral grey, "nicht im Jagdrecht",
   excluded from any tally.
3. **Gesamt mode** — species + Gesamt. Per state, aggregate the species' class cells: solid green when
   all classes resolve to open, solid red when all closed, otherwise a **split fill** signalling
   "kommt auf die Klasse an" (aria: "teils offen, teils Schonzeit"). `null` cells → neutral.

**State click** in every mode → `/state/<code>` with the current `?tags=` appended, so the state page
(which already reads tags from the URL) opens pre-filtered.

## Placement & progressive enhancement

- Homepage (`src/pages/index.astro`): the map becomes the headline chooser, above the existing
  "Bundesland wählen" card grid. The card grid stays as a fallback and is the `<noscript>` path.
- SSR renders each state polygon/callout as an `<a href={href('state/xx')}>`, so **clicking works
  before and without JS**. Filtering, search, counts, and colours are the JS enhancement. This matches
  the existing noscript handling on the state pages.
- The map island is `client:load` (interactive immediately, no flash-of-no-map since SSR drew the
  navigable outline).
- **No "today"-dependent value is baked into SSR.** The server render emits only the neutral,
  navigable outline (links + labels) — never counts or traffic-light colours, which would be frozen at
  build time and go stale. `computeStatus(season, new Date())` runs on the client after mount; counts
  and fills appear on hydration. This avoids an SSR/CSR mismatch and keeps the static fallback honest
  (it makes no claim about _today_).

## Pure logic & testing

- Extract the decision logic into `src/lib/mapStatus.ts`, pure and date-injectable:
  `perStateView(matrix, selection, now) → Map<code, { mode, count? , status?, split?, present }>`.
  Keeping it pure (no DOM, `now` passed in) makes it node-testable and keeps the island thin.
- `scripts/test-mapstatus.mjs` (same harness as `scripts/test-status.mjs`,
  wired into `npm test`) covering:
  - count semantics: 🟢 and 🟠 count, 🟡/🔴 do not;
  - traffic-light mapping per `StatusKind`;
  - **Gesamt mixed** — Rehwild on a June date: Rehbock open, Kitz/Schmalreh closed → split;
  - `null` cell → neutral/`present:false`, never counted;
  - date sensitivity (same key, two dates, different result).
- Verification gate: `npm run build` clean (page count unchanged at 19 — map sits on the existing
  homepage), `npm test` green, `mcp__ide__getDiagnostics` clean on the new/edited files, and a manual
  `npm run dev` pass (map navigates with JS off; chips/search/class-toggle drive colours with JS on).

## Out of scope (YAGNI)

- Browser geolocation / auto-highlight (#38) — separate task; only the GeoJSON asset is shared.
- Pan/zoom, tile layers, shipping the GeoJSON to the client.
- Leaflet at runtime — remove `leaflet`/`@types/leaflet` from `package.json` (re-add for #38 only if
  that task actually needs it; `@turf/*` stays for #38's point-in-polygon).

## Affected files

- New: `src/components/GermanyMap.tsx`, `src/lib/mapStatus.ts`, `src/lib/geo/germany-states.ts`
  (generated), `scripts/build-germany-svg.mjs`, `scripts/test-mapstatus.mjs`, `data/geo/*.geojson`
  (source).
- Edit: `src/pages/index.astro` (mount island above the card grid), `data/geo/README.md` (provenance),
  `package.json` (drop `leaflet`, add `test-mapstatus` to `npm test`), `DESIGN_SPEC.md` (map section).
- Reuse unchanged: `CategoryFilter.tsx`, `filters.ts`, `tags.ts`, `status.ts` (`computeStatus`),
  `data.ts` (`buildMatrix`), `paths.ts` (`href`), `global.css` (traffic-light tokens).
