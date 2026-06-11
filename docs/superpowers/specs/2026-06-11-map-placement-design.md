# Map placement: overview as home, map onto species pages (#72)

**Date:** 2026-06-11
**Status:** Approved — ready for implementation plan

## Context

The interactive `GermanyMap` currently headlines the home page in **count mode** (a
choroplith of "how many species are huntable per state today", with its own species
picker, search, and category filter). It doesn't pull its weight there: the prime
question is "is *this species* open in my Bundesland", and a per-state *count* answers
something nobody asked. Meanwhile the genuinely useful cross-state view — the
`SeasonMatrix` ("what's open this month, per species, per state") — is buried at
`/overview`, one click away.

The map's most valuable mode already exists but is unreachable by default: its
**single-species mode** (`perStateView` → traffic-light per state for one chosen species,
with a class toggle). That is exactly what a **species detail page** wants — "where is
this species open right now, geographically".

This change swaps the two: the overview matrix becomes the home page, and the map moves
to the species pages, pinned to that page's species. The count-mode/picker machinery,
having no remaining caller, is removed.

## Goals

- Land users on the cross-state overview (the matrix) at `/`.
- Give each species page a geographic "where is it open now" map, complementing its
  existing ranked open-first list.
- Remove now-dead code (count mode, the in-map species picker) rather than leave it
  orphaned.
- No regression to the no-JS path, payload size, or the 16-state navigation.

## Decisions (confirmed)

1. **Home = matrix + state grid + upcoming.** The `SeasonMatrix` is the hero; the static
   16-state picker grid and "Bald verfügbar" stay below it. The grid is server-rendered,
   so it doubles as the no-JS navigation (the matrix is `client:only`).
2. **`/overview` is removed** — `/` is the canonical overview. Build: 106 → 105 pages.
3. **Drop the map's unused modes** — count mode, species search/picker, category filter.
   On species pages the species is pinned (class toggle kept). `perStateView`'s count
   branch and `speciesOptions` go too.

## Architecture

### Per-species data without payload bloat

The map needs every state's season for one species. Passing the full `matrix` to a
`client:only` island would serialize ~106 rows × 16 states into **every** one of the 86
species pages — the same bloat class as the earlier `source`-field regression.

**Chosen approach:** a slim slice. `speciesMatrix(speciesKey)` returns a valid
`SeasonMatrix` containing only that species' rows:

```ts
// src/lib/data.ts
export function speciesMatrix(speciesKey: string): SeasonMatrix {
  const full = buildMatrix();
  return {
    states: full.states,
    rows: full.rows.filter((r) => r.speciesKey === speciesKey),
  };
}
```

`perStateView` already groups rows by species and reads only the selected one, so it
works on this slice **unchanged** — the tested status logic and the map's render path
stay identical, and the props payload is ~16 states + 1–4 rows.

Rejected: passing the full matrix (reintroduces bloat); a new per-species status function
over `getSpeciesDetail`'s shape (duplicates tested `perStateView` logic).

### Components & data flow

```
/                      index.astro
  └─ SeasonMatrix (client:only, buildMatrix())   ← hero
  └─ state-picker grid (static)                   ← also the no-JS nav
  └─ "Bald verfügbar" (static)

/species/[slug]        species/[slug].astro
  └─ tag chips (static)
  └─ GermanyMap (client:only, speciesMatrix(key), speciesKey=key)   ← spatial
  └─ SpeciesStateList (client:only)                                 ← ranked detail
  └─ <noscript> per-state season list (existing)
```

## Components

### `index.astro` (home)
- Render `<SeasonMatrix client:only="react" matrix={buildMatrix()} />` as the lead
  content under the H1 + tagline.
- Keep the static state-picker grid and "Bald verfügbar" block below it.
- Remove the `→ Übersicht aller Länder & Arten` link and the `<GermanyMap>` section.
- The matrix's `<noscript>` text points to the state grid on the same page.

### `overview.astro`
- Deleted.

### `species/[slug].astro`
- Add `import { GermanyMap }` and `speciesMatrix` from `../lib/data`.
- Between the tag chips and `SpeciesStateList`, mount
  `<GermanyMap client:only="react" matrix={speciesMatrix(key)} speciesKey={key} />`.
- Existing `SpeciesStateList` and `<noscript>` fallback unchanged.

### `GermanyMap.tsx` (fixed-species map)
- Props become `{ matrix: SeasonMatrix; speciesKey: string }`.
- **Remove:** count-mode rendering and the per-state number `<text>` labels; the species
  search + picker list; the `CategoryFilter`; the count legend + count-mode `aria-label`
  branch; **all** URL state (`?species=`/`?class=`/`?tags=`) and its sync effects. The
  class toggle is in-memory only (the species is fixed by the route; deep-linking a class
  is niche and not worth the URL machinery).
- **Keep:** the SVG (states + city callouts), `single`/`gesamt` fill incl. the `mixed`
  pattern, the **class toggle** (derive class options from the slice's `/`-keyed rows,
  replacing `speciesOptions`), the status legend, "Als Liste anzeigen" details, and the
  per-state links carrying `?q=<species label>` into state pages.
- `CategoryFilter` / `SpeciesSearch` components are **not** deleted (used by
  `SeasonMatrix` / `StateSeasonList`); just unimported here.

### `mapStatus.ts`
- `perStateView`: drop the `if (!selection.speciesKey)` count branch (the map always has
  a species now).
- `StateCell`: remove the `{ mode: "count"; count: number }` variant.
- Remove `speciesOptions` and `SpeciesOption` (only the picker used them).
- Drop `tags` from `MapSelection` — only the count branch read it; `single`/`gesamt` do
  not. `MapSelection` becomes `{ speciesKey, classKey }`.

## Cross-links touched

- `index.astro`: the `href("overview")` link is removed (only real link to the route).
- No global nav exists (Layout has no header), so nothing else references `/overview`.
- "overview" mentions in `data.ts` / `status.ts` / `filters.ts` comments describe the
  *concept* and stay accurate — leave them.

## Testing

- `mapStatus.test.ts`: drop the count-mode and `speciesOptions` cases; keep
  `single`/`gesamt`/`absent` (still the map's behavior).
- `data.test.ts`: add a `speciesMatrix` invariant test — for a known species
  (`schwarzwild`), returns all 16 states and only that species' rows; unknown key → empty
  rows, full states.
- `dataValidation`, `status`, `timeline`, `filters`, `format`, `states`, `tags`,
  `seasons` suites unaffected.
- Build: **105 pages** (overview removed). `npm test`, `npm run lint`,
  `npx tsc --noEmit` green.
- Manual: home shows the matrix + grid; a species page shows the pinned map (correct
  species, class toggle for split species like `reh`, state links carry `?q=`); no-JS
  home still navigates via the grid.

## Out of scope (YAGNI)

- `SeasonMatrix` internals — it only moves routes, no behavior change.
- State pages, the import skill, the data model.
- A redirect stub for `/overview` (route removed outright; site is new on the apex
  domain).
- Any new map interactions beyond the existing single/gesamt + class toggle.

## Risks

- **Payload** — mitigated by the slim `speciesMatrix` slice.
- **No-JS home** — mitigated by keeping the static state grid (it is the fallback).
- **Dead-code removal reach** — count mode / `speciesOptions` deletions must not touch the
  shared `CategoryFilter`/`SpeciesSearch` components or `monthStatus`; verified by the
  full suite + build.
