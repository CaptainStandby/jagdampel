# Jagdampel — Design Spec

> **Audience: AI coding agents.** This is the source of truth for _what_ Jagdampel is and _why_ the
> decisions were made. Read it before implementing. When a decision changes, change it here first.
> Keep it concise and current — stale specs are worse than none.

## 1. Purpose

Jagdampel is a static website that tells German hunters, at a glance, whether a given species is
currently in season (**Jagdzeit**) in their federal state (**Bundesland**), and if not, when it opens.

**Prime question the site must answer in seconds:**

> _"Is this species open right now in my Bundesland — and if not, when will it be?"_

Everything else is secondary to answering that question fast and unambiguously.

## 2. Audience & UX principles

- Hunters, many **not digitally versed** and often on **slow rural connections / mobile in the field**.
- **Traffic-light metaphor** drives the whole UI (hence the name: _Jagd_ + _Ampel_):
  - 🟢 **green** — open now (Jagdzeit)
  - 🟡 **yellow** — opens soon (within a configurable lookahead, default 30 days)
  - 🔴 **red** — closed (Schonzeit)
- Big targets, minimal text, no jargon beyond what hunters already use.
- **No accounts, no tracking, no cookies.** Fully static.
- **Accessibility:** color is never the _only_ signal — always pair the traffic-light color with a
  text label and/or icon (colorblind users, bright sunlight).

## 3. Scope

### In scope

- The 16 German Bundesländer.
- Per-state, per-species hunting seasons, including **sex** (`maennlich`/`weiblich`) and **age-class**
  (e.g. `Kitz`, `Kalb`, `Schmalreh`) distinctions — these genuinely differ in German law, especially
  for Schalenwild (hoofed game).
- "What's open now" view, season calendar/timeline, category filter, state selection, per-species
  detail.

### Out of scope (for now)

- Non-German regions.
- Bag limits, weapon restrictions, licensing, legal advice.
- User-submitted data at runtime (contributions happen via Git PRs).
- Any server-side component.

> ⚠️ **Legal/safety note:** Jagdzeiten are set per Bundesland by _Landesjagdverordnungen_ and can change
> by year. Jagdampel is an **orientation aid, not a legal source.** Every page must carry a disclaimer
> pointing users to the official Landesjagdverordnung. Until verified real data is supplied, all
> shipped season data is **clearly-labeled stub data** and must not be presented as authoritative.

## 4. Tech stack & rationale

| Layer               | Choice                                                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Astro 6** (`output: 'static'`)                                    | Ships zero JS by default; hydrate only interactive islands. Ideal for content-heavy + a few widgets on slow connections.                                                                                                                                                                                                                                                                                                                                      |
| Interactive islands | **React 19** via `@astrojs/react` 5                                 | Map and filters as isolated islands.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Styling             | **Tailwind v4** via `@tailwindcss/postcss` (`postcss.config.mjs`)   | Utility-first; theme tokens (incl. `jagd-*` colors) defined in `src/styles/global.css` `@theme`. **Note:** v4 dropped the `@astrojs/tailwind` integration — do not reintroduce it. We use the **PostCSS** plugin, _not_ `@tailwindcss/vite`: Astro 6's default rolldown-vite bundler is incompatible with the Tailwind Vite plugin (`Missing field tsconfigPaths`, withastro/astro#16542). Do not switch back to the Vite plugin until that's fixed upstream. |
| Map                 | **Inline SVG** generated from Bundesländer GeoJSON (no Leaflet)     | Server-rendered (navigable without JS), a few KB, recolours client-side. The GeoJSON is a build input (`scripts/build-germany-svg.mjs` → `src/lib/geo/germany-states.ts`), not shipped for the map.                                                                                                                                                                                                                                                           |
| Hosting             | **GitHub Pages** via Actions, **custom apex domain `jagdampel.de`** | `site: https://jagdampel.de`, served from root so **no `base`** (default `/`). `public/CNAME` (= `jagdampel.de`) ships in the artifact so the Actions deploy keeps the custom-domain binding. The old `captainstandby.github.io/jagdampel/` project URL redirects to the apex domain.                                                                                                                                                                         |

**Hard constraints:**

- Must build to fully static output (`astro build` → `dist/`).
- Keep internal links and asset URLs `base`-aware via Astro's helpers (`paths.ts` / `BASE_URL`);
  never hardcode a leading path. (Currently `base` is `/` for the apex domain, but routing through the
  helper keeps the site relocatable if the base ever changes again.)
- Keep client JS minimal — every island must justify its bytes.

## 5. Data model

**Three artefacts, merged at render time.** Federal law is the nationwide default; each state
regulation writes _deviations_. Duplicating federal seasons into all 16 states would be a maintenance
nightmare, so we don't.

- `data/taxonomy.json` — the **registry**: every species under the Jagdrecht, keyed by a stable ascii
  `speciesKey`, with a canonical `label` and its class _atoms_ (`classes`, e.g. `reh` →
  `{kitz, schmalreh, ricke, bock}`). Single source of truth for the universal merge key, for
  whole→atom expansion, and (later) for filter `tags` (Hochwild/Niederwild/Schalenwild/…).
- `data/federal.json` — the **base layer**: the complete § 2 BJagdG roster. Species with a
  Bundesjagdzeit get `range`/`year-round`; species with none get `closed`. Regulation "Sammeleinträge"
  (_Dam- und Sikawild_, the duck/goose/gull groups) are split into individual species.
- `data/states/<code>.json` — a **delta layer**: only the state's overrides, Landesrecht additions,
  and _ganzjährige Schonungen_ (`closed`).
- `mergeSeasons(federal, state, taxonomy)` in `src/lib/seasons.ts` produces the **effective** seasons.
  All files validate against `data/schema.json`.

```jsonc
// data/states/sh.json — deltas only
{
  "state": "SH",
  "name": "Schleswig-Holstein",
  "source": { "regulation": "…", "asOf": "2026-06-01" }, // citation for the disclaimer
  "seasons": [
    {
      "key": "rotwild/kalb", // universal key: taxonomy speciesKey[/classKey]
      "type": "range", // "range" | "year-round" | "closed"
      "periods": [
        // 1+ ranges (range only); >1 = disjoint seasons
        { "start": "08-01", "end": "01-31" }, // MM-DD inclusive
      ],
      "notes": "SH § 2 Abs. 1: Kälber 1. August bis 31. Januar (Bund bis 28. Februar).",
    },
    // rotwild/alttier and rotwild/hirsch are NOT here — they carry through from federal.json.
  ],
}
```

### The universal key (verbatim names are just flavour)

Matching is on the canonical **`key`**, never on German wording. So Bavaria's _Geißen_ and the federal
_Ricken_ are both `reh/ricke` and override cleanly; the verbatim term survives only in `notes`. This
also reconciles the fact that states slice species differently (see expansion below). Display labels
come from the taxonomy (`speciesLabel`/`classLabel` helpers).

### Merge semantics (`mergeSeasons`)

1. **Resolve each layer** against the taxonomy: a **whole-species** entry (bare `key`, no `/`) for a
   species the taxonomy splits is **expanded into one entry per atom**, inheriting the season. Explicit
   class-level entries are applied last, so they override expansions. This is what makes cross-grain
   overrides work: federal `dachs` (whole) becomes `dachs/adult` + `dachs/juvenil`, which Bavaria's
   per-age entries then replace; and federal `fasan` (whole, unsexed) becomes `fasan/hahn` +
   `fasan/henne`, so SH can close only `fasan/henne` while cocks stay on the federal season.
2. **Overlay**: the state's resolved entries replace federal entries with the same `key`; new keys are
   additions; untouched federal entries carry through. Each effective entry is stamped
   `provenance: "state" | "federal"`. (Stored files never contain `provenance`.)

Because of (1)+(2), a state may be a sparse delta (SH omits adult deer → filled by federal) **or** a
near-complete restatement (Bavaria overrides almost everything) with **one** merge rule — no per-state
mode needed.

### Conventions

- **`type`** distinguishes the three cases the law produces: `range` (open during `periods`),
  `year-round` (_ganzjährig_; no `periods`), `closed` (_ganzjährige Schonzeit_; no `periods`).
- **Permit-only** hunting (e.g. Bavaria Fischotter/Wolf — huntable only under an individual
  _Ausnahme/Befreiung_, no calendar) is `type: "range"` with **empty `periods` + `conditional: true`**
  - `conditionNotes`. Status logic yields "not open now, only by permit"; the UI must show it
    distinctly, never a plain 🟢.
- **`periods` is an array** — disjoint seasons (Schmaltiere `05-01`–`05-31` _und_ `09-01`–`01-31`).
- **Dates are `MM-DD` only**; a period **wraps the year** when `end < start`. `02-28` is stored
  verbatim per the law (no leap-day handling yet).
- **`conditional`** marks seasons open only under legal restrictions (Vergrämung/Schadensabwehr,
  spatial limits, or a permit). Always surfaced distinctly from a plain open season.
- **No `category` field (yet).** Game categories will live as `tags` on the taxonomy when added (§3).
- `state` codes use the standard German abbreviations: BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL,
  SN, ST, SH, TH.

> **Deferred — "regime" seasons.** Some states add _extra_ seasons for an animal under a separate legal
> basis on top of its base season (Bavaria: Ringeltauben damage-control windows; the July season for
> sitting juvenile Grau-/Kanadagänse). The current model has no concept for stacking multiple
> independent seasons on one `key`, so these are **omitted and flagged** in `by.json`'s `source.deferred`
> until we design a regime field.

### Status computation (define once, reuse everywhere)

Given "today" in **Europe/Berlin** timezone and a season:

- `type: "year-round"` → always **open**.
- `type: "closed"` → always **closed** (no Jagdzeit).
- `type: "range"` → **open** if today ∈ any period (wrap-aware); else **soon** if the next period start
  is within the lookahead window (default 30 days); else **closed**.
- A `conditional: true` season that is currently open must surface as a **distinct fourth state**
  ("open with restrictions"), never a plain 🟢 — the user has to see the condition.

## 6. Information architecture

```
/                         Home: state list (+ link to overview) → "what's open now" for a state
/state/[code]             Per-state: list (traffic-light) + calendar (timeline), category & huntable filters
/overview                 Cross-state matrix: species/class rows × state columns, coloured by month
/species/[slug]           Cross-state view of one species: all 16 states, ranked open-first
```

Home is a **one-step chooser**: land → pick your Bundesland (on the map or the card grid) → see your
state's open species. State pages live at stable `/state/<code>` URLs, so visitors can bookmark their
own state and skip the chooser entirely on return.

`/species/[slug]` is the inverse axis: pick a species, see where it is open _right now_ across all 16
Bundesländer. `slug` is the taxonomy `speciesKey` (already URL-safe). Reachable by linking the species
name from the per-state list and the overview matrix; one generic route over the taxonomy, no
per-species code.

## 7. Planned components (React islands unless noted)

| Component           | Role                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GermanyMap`        | Inline-SVG map on the homepage (primary chooser). Category filter → per-state count; pick one Art → traffic-light; class toggle with a "Gesamt" split-fill. Click a state → its page (carries `?tags=`). Decision logic in `mapStatus.ts`. See "Homepage map (#39)" below.                                                                                                                      |
| `SeasonStatusBadge` | The traffic-light badge: color + label + icon. Pure, reused everywhere. Must render the "open with restrictions" state for `conditional` seasons.                                                                                                                                                                                                                                               |
| `SeasonTimeline`    | Year-long horizontal calendar bar per species, with per-`class` sub-rows shaded by each open period (handles multiple disjoint periods). The "multidimensional calendar".                                                                                                                                                                                                                       |
| `CategoryFilter`    | Toggle chips for the taxonomy `tags` (Schalenwild, Hochwild, Niederwild, Raubwild, Haarwild, Federwild, Wasserwild, Rabenvögel, Greifvögel, Neozoen). Union/OR filter applied to both list and calendar; only tags present in the state are shown. Vocabulary in `src/lib/tags.ts`.                                                                                                             |
| `SeasonMatrix`      | `/overview` cross-state grid: species/class rows × state columns, cells coloured by `monthStatus` for a selected month (default current, `?month=`). Gray cell = species absent from that state's Jagdrecht (rare until per-state presence is modelled, §9). Species labels link to `/species/<key>`.                                                                                           |
| `SeasonGroup`       | Shared presentational item: a labelled thing (a species on a state page, a state on a species page) with 1+ class seasons and a live traffic-light, foldable when the classes disagree. Optional title link; the fold toggle is the chevron+count so the link never nests in a button. Plus `StatusSummary` (the count strip) and the `RANK`/`liveText` helpers. Consumed by both list islands. |
| `SpeciesStateList`  | `/species/[slug]` island: one species across all 16 states, ranked open-first ("where is it open right now"), each state titled and linking to `/state/<code>`. The inverse of `StateSeasonList`; both share `SeasonGroup`. No filters (a single species needs none).                                                                                                                           |
| `Disclaimer`        | Legal disclaimer + link to official source (`source` field). Present site-wide. Generic (source-less) on the overview and species pages, which span all states.                                                                                                                                                                                                                                 |

Shared, framework-agnostic logic lives in `src/lib/` as plain TS so both `.astro` and `.tsx` can
import it. Already present: `seasons.ts` — `Season`/`Period`/`Taxonomy` types, the pure
`mergeSeasons(federal, state, taxonomy)`, and `speciesLabel`/`classLabel` helpers. Still to add:
status computation + date math (§5), data loading.

### Homepage map (#39)

The homepage leads with an interactive Germany map as the primary Bundesland chooser; the state-card
grid stays below as a fallback (and the no-JS path).

- **Rendering:** inline SVG, server-rendered so each state is a navigable `<a>` even without JS,
  generated from simplified Bundesländer GeoJSON by `scripts/build-germany-svg.mjs` →
  `src/lib/geo/germany-states.ts`. No Leaflet at runtime. City-states (HB, HH, BE) get margin callout
  markers so they stay clickable.
- **Data:** fed by `buildMatrix()`; status is computed client-side for "today" (`computeStatus`), so
  nothing date-dependent is baked into the static HTML (SSR emits only the neutral outline).
- **Modes:** category filter → count of huntable Arten (🟢 + 🟠) per state; pick one Art → per-state
  traffic-light; an Art with classes shows a class toggle whose "Gesamt" uses a split fill when the
  classes disagree. Clicking a state opens `/state/<code>` with the active `?tags=`. Params are English
  (`?species=`, `?class=`, `?tags=`).
- **Logic:** pure, in `src/lib/mapStatus.ts`, tested by `scripts/test-mapstatus.mjs`.

## 8. Data maintenance

- **Edit federal once, states stay thin.** A nationwide change is a one-line edit in
  `data/federal.json`; a state file only holds that state's deviations.
- **New species or class split → taxonomy first.** Add the `speciesKey`/atoms to `data/taxonomy.json`,
  then reference it from the season files. Filter `tags` (Hochwild/Niederwild/…) will live here too.
- Real Jagdzeiten are added/corrected via **Git PRs**, validated against `data/schema.json`.
- Build should (eventually) fail if any data file violates the schema, references a `key` absent from
  the taxonomy, or `mergeSeasons` produces a contradiction — wrong dates are a safety problem, so
  validation is a gate, not a warning. (Currently verified by an ad-hoc script; needs a test runner.)
- Source GeoJSON for the homepage map lives in `data/geo/` (a build input for the SVG generator; see
  its README). Use a **simplified** resolution. Nothing is shipped to the browser for the map.

## 9. Current status (2026-06-09)

**Done:**

- Astro + React + Tailwind v4 toolchain, pinned & building.
- GitHub Pages deploy workflow.
- `data/schema.json` for the keyed model; `data/taxonomy.json` (86 species registry).
- **`data/federal.json`** — complete § 2 BJagdG roster (82 entries; no-season species as `closed`).
- **`data/states/*.json` — all 16 Bundesländer.** Deltas: SH 50, BY 33, HE 58,
  MV 32, NI 53, HH 37, BB 50, SN 33, HB 16, RP 54, NW 56, BE 41, BW 60, ST 31, TH 46, SL 33.
  HH/BB/SN/HB/RP/NW/BE/BW/ST/TH were imported in one parallel multi-agent batch (one worktree+branch
  per state, web-sourced from each official Landesrecht portal). **These 10 are DRAFT/web-sourced and
  pending human verification** — per-state caveats live in each commit body; common one: schonzeiten.de
  is stale/federal-fallback for many states, so the official text was always trusted over it. SL was
  imported last from a user-supplied source file (DV-SJG Anlage 3) — also DRAFT pending verification.
- **`src/lib/seasons.ts`** — types + pure `mergeSeasons` (taxonomy-driven, whole→atom expansion).
  Verified (consolidated run, all 16): effective seasons 99–111 per state. Taxonomy grew during the
  batch: `gamswild` gained `{jaehrling,geiss,kitz,bock}` (BW), `nilgans` gained `{adult,juvenil}`
  (NW+ST, unified), `schnatterente` was added (BW), and `streifengans` was added (SL).
- **Status engine — `src/lib/status.ts`** (the brain): pure `computeStatus(season, now, lookahead)`
  → `open | conditional | soon | closed`, Europe/Berlin "today" via `Intl`, wrap-aware periods,
  inclusive 30-day "soon" lookahead, permit-only handled distinctly. Unit-tested headless via
  `scripts/test-status.mjs` (`npm test`, 18 cases incl. DST, wrap, lookahead boundary).
- **UI slice 1 (traffic light, end to end):** `data.ts` (build-time loader: JSON + `import.meta.glob`,
  merge, group-by-species), `format.ts` (German dates), `paths.ts` (base-aware links),
  `SeasonStatusBadge.tsx` (4-state badge — colour + icon + label), `StateSeasonList.tsx`
  (`client:only` island, computes status on the visitor's clock, sorts open-first, summary counts),
  `Disclaimer.astro`, home page (state picker list), and `/state/[code]` (all 16 states) with
  a `<noscript>` static fallback.
- **Calendar view — `SeasonTimeline.tsx` + `src/lib/timeline.ts`:** year-bar timeline (per-class
  bars, wrap-aware segments, "heute" line), with a Liste/Kalender toggle reflected in the URL
  (`?view=`). Segment math unit-tested (`scripts/test-timeline.mjs`).
- **Category filter — `CategoryFilter.tsx` + `src/lib/tags.ts`:** all 86 species tagged; OR filter on
  both views; state in the URL (`?tags=`). Verifier checks tags against the vocabulary. Plus a
  "nur jagdbare Arten" toggle (`?huntable=1`) hiding all-year-closed species.
- **Overview matrix — `/overview` (`SeasonMatrix.tsx` + `buildMatrix` + `monthStatus`):** species/class
  rows × state columns, coloured by month (selector, `?month=`); sticky header/first column.
- **Species pages — `/species/[slug]` (`SpeciesStateList.tsx` + `getSpeciesDetail`):** the inverse axis,
  one species across all 16 states ranked open-first; generic `getStaticPaths` over the taxonomy (one
  page per species, `slug` = `speciesKey`). Reachable via species-name links from the per-state list and
  the overview. The foldable per-item widget was extracted to `SeasonGroup.tsx`, now shared by both list
  islands. 106 static pages now build (16 states + overview + home + impressum + datenschutz + 86
  species).

**Decided (was open):**

- **Live status = client-side.** Because this is static but must answer "right now", the season list
  is a `client:only="react"` island computing from `new Date()` — never a stale build-time light. No
  daily-rebuild cron. Trade-off: the list needs JS to show the light; the `<noscript>` fallback shows
  species + raw calendars so the page is never useless.
- **Lookahead = 30 days** (inclusive), `DEFAULT_LOOKAHEAD_DAYS` in `status.ts`.

**Not yet built:**

- Schema/merge validation inside `astro build` (currently the node verifier + `npm test` gate it
  out-of-band). **Human verification of the 11 draft states** (the 10 web-sourced batch + SL).
  (`GermanyMap` + the SVG geometry asset and `/species/[slug]` are now built — see §7.)

> **Dropped (#38) — geolocation.** A "use my location" StateSelector (Geolocation API + Turf
> point-in-polygon) was specced and deliberately cut as over-engineering: the map/card chooser is one
> click and `/state/<code>` is bookmarkable, so GPS bought little for the privacy/GDPR + payload cost.
> `@turf/*` and the reserved `public/geo/` were removed with it.

**Open questions for the human:**

1. ~~Whether the map is on the home page or a separate overview.~~ **Resolved (#39):** homepage,
   primary chooser, with the card grid as fallback.
2. Per-state **presence** filtering: federal seasons flow to every state, so a species federally
   huntable but locally absent (e.g. Gamswild in SH) appears. Leave it (legally correct) or add an
   optional per-state suppression list later?
3. The deferred **regime** concept (§5) — when to model stacked damage-control seasons.
4. For a season that is `conditional` **and** opening within the lookahead, the badge currently shows
   🟡 "Bald" (not the amber "Mit Auflagen") until it actually opens — restriction notes still render.
   Keep, or surface the restriction pre-opening?

## 10. Data provenance & decisions

Effective seasons = `data/federal.json` overlaid with a state delta via `mergeSeasons`. Sources are in
each file's `source` block. **This is an orientation aid, not legal advice** — verify against the
official regulation before trusting it.

**Cross-cutting decisions:**

- **Category tags (verify the classification).** Each species carries `tags` (vocabulary in
  `src/lib/tags.ts`) driving the `CategoryFilter`. **Hoch-/Niederwild is a _legal_, exhaustive
  partition** per **§ 2 Abs. 1 BJagdG**: _"Zum Hochwild gehören Schalenwild außer Rehwild, ferner
  Auerwild, Steinadler und Seeadler. Alles übrige Wild gehört zum Niederwild."_ Therefore **every
  species carries exactly one of `hochwild`/`niederwild`** — enforced by `verify-import.mjs`. Applied:
  _Hochwild_ = all Schalenwild except Rehwild (Rot-/Dam-/Sika-/Gams-/Stein-/Muffel-/Schwarzwild, Elch,
  Wisent, **Muntjak** — a Schalenwild deer, so Hochwild despite its size) + Auerwild; everything else
  (incl. Reh, the large predators Wolf/Luchs/Wildkatze/Fischotter/Goldschakal, all other Federwild) =
  _Niederwild_. _Raubwild_ = carnivorous Haarwild (orthogonal to Hoch-/Nieder; Fuchs/Dachs/mustelids
  are both Raubwild and Niederwild). _Federwild_ = all birds; _Wasserwild_ = waterfowl incl. Möwen,
  Blässhuhn, Graureiher; _Greifvögel_ = Greife/Falken; _Rabenvögel_ = corvids. **One subsumption to
  note:** § 2 names Steinadler & Seeadler as Hochwild, but the taxonomy folds all eagles into the
  `greife` collective (all ganzjährig geschont); that collective is tagged `niederwild` (its majority)
  — split the eagles into their own species if per-eagle accuracy is ever needed.
- **Neozoen = established in Germany after 1492** (the ecological cutoff; pre-1492 introductions are
  Archäozoen and are _not_ tagged). Tagged: the introduced Schalenwild Dam-/Sika-/Muffelwild,
  Muntjak, Waschbär, Marderhund, Mink, Nutria, Nasenbär, Wildtruthuhn, Kanada-/Nil-/Rostgans,
  Schwarzkopf-Ruderente, Pharaonenibis. **Not** tagged: Fasan and Wildkaninchen (Archäozoen,
  pre-1492), Goldschakal (natural immigrant, not human-introduced), Wolfshybrid (not a species).
  _Damwild is the one judgment call_ — present German populations are post-1492 game-park stock, but
  Romans introduced it in antiquity; tagged Neozoon under the post-1492 rule.
- **Universal key, verbatim = flavour.** States name classes differently (Bavaria _Geißen_ = federal
  _Ricken_; Bavaria splits _Alttiere_ + _alle übrigen Hirsche_ where federal combines _Hirsche und
  Alttiere_). All matching is on the canonical `key`; the German wording lives in `notes`. Whole→atom
  expansion (§5) reconciles differing granularity (Bavaria splits Dachs/Steinmarder into adult/juvenil;
  federal/SH keep them whole).
- **Full roster.** Every § 2 BJagdG species is present; those without a Bundesjagdzeit are `closed`
  (Wolf, Luchs, Wildkatze, Seehund, Fischotter, Wisent, Elch, Steinwild, Schneehase, Murmeltier,
  Wachtel, Auer-/Birk-/Rackel-/Haselwild, Alpenschneehuhn, Großtrappe, Graureiher, Haubentaucher,
  Säger, Greife, Falken, Kolkrabe).
- **`02-28`** kept verbatim per the law (no leap-day handling).
- **`ganzjährig` is context-dependent.** In a Jagdzeit table it means year-round _huntable_
  (`year-round`); a species with no listed open season is `closed`. Hessen writes the latter explicitly
  as _"keine Jagdzeit"_. We read each per its surrounding heading — never map the word blindly.
- **Conditional ≠ permit-only.** `conditional` covers two things, both surfaced distinctly from 🟢:
  population/spatial Maßgaben on an otherwise-open season (Hessen Graugans Natura-2000 zones, Rebhuhn
  density quota), _and_ permit-only hunting with no calendar (Bavaria Fischotter/Wolf — empty
  `periods`). Spatial restrictions remain free text in `conditionNotes` (not machine-structured yet).

**Schleswig-Holstein (verify against the Landesverordnung):**

- **Fasan exception (confirmed):** federal _Fasanen_ open + state `fasan/henne` → closed = only cocks
  huntable.
- **Silbermöwe stays open:** SH § 2(2) protects the other four gull species but not Silbermöwe.
- **§ 2(3) Deich-area year-round override** (Wildkaninchen, Füchse, Dachse, Nutria on
  Deichkörper/Warften) is captured in `notes`, not as separate rows.

**Bavaria (verify against AVBayJG § 19):**

- **Permit-only Fischotter & Wolf** (§ 19 Abs. 4/5): `conditional` with empty `periods`; no calendar
  season, only under an individual _Ausnahme/Befreiung_. Override the federal `closed`.
- **Graureiher** (§ 19 Abs. 2): `conditional` open 16.9.–31.10. with a 200 m spatial limit — the
  spatial restriction is free text in `conditionNotes` only.
- **Deferred regimes** (`by.json` → `source.deferred`): Ringeltauben damage-control windows and the
  July season for sitting juvenile Grau-/Kanadagänse are **omitted** pending a regime model (§5).
- Bavaria's § 19 is a complete enumeration, but entries identical to federal (Iltis, ducks, gulls,
  Stockente, Wildtruthuhn, Waldschnepfe, Höckerschwan, …) are **omitted** and inherited, keeping the
  delta thin.

**Hessen (verify against HJagdV vom 24.10.2022, § 2):** _Validated the schema with no new fields._

- **`keine Jagdzeit` → `closed`.** Hessen closes a lot of waterfowl that is open federally: Türkentaube,
  Fasanenhennen, both Wildtruthuhn sexes, Bläss-/Saat-/Ringelgans, the whole duck group, **and all five
  gull species incl. Silbermöwe** (unlike SH). Fasanenhähne stay on the federal season (only `fasan/henne`
  closed — same pattern as SH).
- **New neozoa** added to the taxonomy: `muntjak`, `goldschakal`, `nasenbaer` (Roter Nasenbär),
  `pharaonenibis`, `schwarzkopfruderente`. All `year-round` except Goldschakal (`keine Jagdzeit` →
  `closed`). Marderhund/Mink/Nutria/Waschbär/Nilgans/Wolfshybrid also year-round.
- **New class atoms** added: Muffelwild `{jaehrling, adult}` (Hessen's _Jährlingswidder und Schmalschafe_
  get a spring+autumn season; adults inherit federal) and Ringeltaube `{adult, jung}` (juvenile doves
  open from 1 July). These expansions ripple harmlessly into SH/BY (same dates, just shown per atom).
- **Combined class rows split:** _Schmalspießer und Schmaltiere_ (one Hessen row) → both atoms;
  _Dam- und Sikawild_ → both species.
- **Maßgaben as `conditional`:** Graugans (Natura-2000 70 m lakeshore zones, full Gebietsliste in the
  law — summarised in `conditionNotes`), Rebhuhn (density/quota/notification), Blässhuhn (population).
- **§ 2a is not seasons** (`he.json` → `source.deferred`): it authorises individual wolf-handling acts
  (sick-animal dispatch, Nachsuche, monitoring) under § 45 Abs. 7 BNatSchG. Wolf stays `closed`
  (inherited from federal) — note Bavaria instead frames its wolf as permit-only `conditional`; both are
  faithful to their respective laws.
- **Version caveat:** the source pages render the Fassung gültig ab 01.04.2026; the valid-from is
  inferred from a sibling tooltip, not stamped on § 2 itself. Re-verify before relying on it.

**Mecklenburg-Vorpommern (verify against JagdZVO M-V vom 14.11.2008, GVOBl. M-V 2008, 445):**

- **Two-layer delta:** § 1 sets deviating open seasons, § 2 _abolishes_ seasons ("Für folgende
  Tierarten wird die Jagdzeit … aufgehoben") → those become `closed`: Mauswiesel, Rebhuhn, Ringel-/
  Saatgans, Berg-/Reiher-/Samt-/Trauerente. Everything § 1 leaves unstated (adult deer, Schwarzwild,
  Fuchs, ducks, Graugans base, …) inherits the federal season — kept thin.
- **Uniform spring start 16. April** for the young Schalenwild classes: Rotwild/Damwild
  _Schmalspießer und Schmaltiere_, Rehwild _Böcke und Schmalrehe_, Muffelwild _Jährling und
  Schmalschafe_ all 16.4.–31.1. Combined male+female rows split into both atoms (same dates);
  adult/Alttier classes stay federal.
- **New species `nandu`** (Großer Nandu, feral Schaalsee population) added to the taxonomy with two age
  atoms: `jung` (Küken und Jährlinge → `year-round`) and `adult` (Hähne/Hennen ab 2 Jahren → 1.11.–
  31.3.). Tagged `federwild`/`neozoen` — Niederwild/Hochwild has no convention for a ratite, so left off.
- **Year-round neozoa/predators:** Marderhund, Waschbär, Mink, Nutria, Dachs, Steinmarder ganzjährig
  (override the federal ranges for Dachs/Steinmarder). Hermelin 16.10.–28.2., Waldschnepfe 16.10.–31.12.
  Corvids opened: Nebel-/Rabenkrähe, Elster 1.8.–20.2.; Nilgans 1.8.–15.1.
- **Deferred (`mv.json` → `source.deferred`):** (1) § 1 Abs. 4 goose damage-control window (15.9.–31.10.,
  Grau-/Bläss-/Saat-/Kanadagans) — a _stacked_ season on top of the base season with a 100 m crop-buffer
  Maßgabe; (2) § 1 Abs. 3 coastal-breeding-area parent-animal hunting (Schwarzwild/Fuchs/Marderhund/
  Waschbär/Mink in Setzzeiten, Anlagen 1–26) — no calendar season; (3) § 1 Abs. 2 Elterntier definition.
- **Version caveat:** the legal text states "Vom 14. November 2008", but the landesrecht-mv permalink/PDF
  identifiers reference a 2009 consolidation and annex validity runs to 2030; § 1/§ 2 carry no explicit
  Inkrafttreten in the source. Re-verify the current Fassung before relying on it.

**Niedersachsen (verify against DVO-NJagdG vom 23.05.2008, zuletzt geänd. 18.01.2021):**

- **Three-layer delta:** § 2 = state-law species (Waschbär/Marderhund/Mink/Nutria/Rabenkrähe/Elster/
  Nilgans), § 3 Abs. 1 = open seasons "abweichend von" the federal BJagdZeitV, § 3 Abs. 2 = "keine
  Jagdzeiten" → `closed` (Mauswiesel, Wildtruthuhn, Bläss-/Saat-/Ringelgans, 6 ducks, 4 gulls).
  Unstated species (Schwarzwild, Muffelwild, Iltis, Hermelin, Stock-/Krick-/Pfeifente, **Silbermöwe**,
  Fasan, Blässhuhn) inherit federal. Cross-checked line-by-line against schonzeiten.de — see conflict below.
- **New class atoms** added to the taxonomy: Waschbär/Marderhund/Mink/Wildkaninchen each get
  `{adult, jung}` (NI gives the juvenile class its own status). Dachs/Fuchs already had atoms. This
  ripples into every state (whole-entries expand per atom; identical dates collapse in the list view,
  add rows in the matrix).
- **Juvenile = year-round, but two flavours.** Jungwaschbär/-marderhund/-mink (§ 2) and Jungdachs
  (§ 3) are explicitly `ganzjährig`. **Jungfüchse and Jungkaninchen are only "ausgenommen" from the
  adult season with no juvenile clause** → modelled as inheriting the federal year-round season (Fuchs
  & Kaninchen are federally year-round). This is an _inference_ (the DVO is silent) but matches
  schonzeiten.de. Flag for verification.
- **Combined rows split:** "Schmaltiere, Schmalspießer" → both atoms (two periods: 1.4.–15.5. u.
  autumn); "Steinmarder und Baummarder" → both species; the § 3 Abs. 2 goose/duck/gull groups → one
  closure each. Sika "Schmaltiere, Schmalspießer, Hirsche" share one date. Adult Hirsche/Alttiere of
  Rot-/Sikawild and Dam-Alttiere are unstated → inherit federal.
- **`conditional`:** Nonnengans (1.8.–15.1.) is entirely permit-gated (BNatSchG-Ausnahme + quota +
  named Landkreise + Sachverständigen-Feststellung) — captured in `conditionNotes`.
- **Deferred (`ni.json` → `source.deferred`):** Ringeltauben Schadensabwehr windows (Alttauben
  20.8.–31.10. & 21.2.–31.3. on top of the inherited 1.11.–20.2. core; Jungtauben 21.2.–31.3.
  sub-window noted only); Höckerschwan/Grau-/Kanadagans **Vogelschutzgebiet** deviations (Anlage 1,
  spatial); §§ 1/4/5 (Schwarzwild-Setzzeit, ASP, fences) are not seasons.
- **❗️Conflict flagged — Stein-/Baummarder start date.** The authoritative DVO § 3 Abs. 1 Nr. 9 reads
  **"16. September** bis 28. Februar"; schonzeiten.de shows **16. Oktober** (= the federal date). I
  encoded the DVO value (16.9.) as authoritative, but this one needs a human to confirm whether the
  third-party site is stale/federal-fallback or the DVO text was misread.

**Batch import — HH/BB/SN/HB/RP/NW/BE/BW/ST/TH (parallel multi-agent, 2026-06-08): ALL DRAFT, verify
before trusting.** Ten states imported in one orchestrated run — one subagent per state, each in its
own git worktree, each web-sourcing its official Landesrecht portal (BRAVORS, revosax, recht.nrw.de,
landesrecht-bw.de, gesetze.berlin.de, transparenz.bremen.de, …) and committing a local `import-<code>`
branch, then cherry-picked onto `main`. Per-state provenance + flags live in each commit body; the
high-signal items:

- **Cross-cutting:** schonzeiten.de proved stale / federal-fallback for several states (Rebhuhn, the
  Berlin § 3 closures, ST Iltis, Reh windows) — official text was trusted over it every time. Several
  states carry very recent amendments (BW DVO JWMG **22.01.2026** V12; BB **24.03.2026**; BE
  **22.08.2025**) that the agents resolved against the consolidated text; re-confirm the live Fassung.
- **Closed-by-enumeration / -omission readings (load-bearing inferences):** RP § 42 and BW § 7-Anlage
  treat unlisted-but-federally-huntable species as `closed`; NW/HE close Rebhuhn for a fixed term
  (NW until 2027); BE § 3 repeals many federal seasons (with a court partial-nullity restoring
  Steinmarder/Blässhuhn/Ringeltaube/Stockente to federal). Confirm each reading.
- **Taxonomy growth:** `gamswild` → `{jaehrling,geiss,kitz,bock}` (BW); `nilgans` → `{adult,juvenil}`
  (NW & ST, unified on `juvenil`); new species `schnatterente` (BW). BW Muffelwild (Widder/Schafe cut)
  did **not** fit the existing `{jaehrling,adult}` atoms → left on the federal season (flagged, not
  modelled).
- Every per-state commit lists its own deferred items (damage-control windows, Vogelschutzgebiet
  spatial deviations, method bans) and ambiguities. **Treat all ten as orientation drafts pending a
  read against the official regulation.**

**Saarland (SL) — DV-SJG Anlage 3 (Ausfertigung 27.01.2000), imported 2026-06-08 from a user-supplied
source file: DRAFT, verify before trusting.** Anlage 3 ("Jagdzeiten im Saarland") is a flat open-season
table with interspersed `ganzjährig geschont` closures and four `ganzjährige Jagdzeit` rows (year-round
huntable). 33 deltas. Key points:

- **Genuine deviations from federal:** Fuchs gets a _closed season_ (1.7.–28.2., vs federal year-round);
  Rehbock opens early (1.4., vs 1.5.); Schmalrehe a split season (1.4.–15.5. **und** 1.9.–31.1.);
  Feldhase ends 31.12. (vs 15.1.); Ringeltaube opens 1.9. (vs 1.11.); most deer classes end 31.1.;
  Hermelin/Dachs shortened. Closures: Iltis, Mauswiesel, Türkentaube, Blässhuhn.
- **"Übrige Wildenten ganzjährig geschont"** → closed for the 8 federally-open ducks except Stockente
  (Pfeif-/Krick-/Spieß-/Berg-/Reiher-/Tafel-/Samt-/Trauerente). Load-bearing reading of the group row.
- **Additions (Landesrecht):** Mink ("Minke" in the source), Marderhund, Waschbär (year-round), Nutria
  (year-round), Nilgans, **Streifengans** (new taxonomy species). The combined row "Nil-, Kanada- und
  Streifengänse" was split to individual species (Kanadagans overrides federal to 1.8.–15.1.).
- **Inferences / carryovers flagged:** Anlage 3 is silent on Höckerschwan, Bläßgans, Ringelgans and all
  Möwen — these inherit the federal open seasons in the merge; whether SL actually hunts them or merely
  omits absent species is unresolved (`source.deferred`). The `[*]` footnote (§ 22 Abs. 4 S. 1 BJagdG,
  Elterntierschutz) on the four year-round rows is carried in `notes`, not modelled as conditional.
  No in-force/last-amended date printed in the file — only the 27.01.2000 Ausfertigung.
