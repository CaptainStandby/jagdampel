# Jagdampel — Design Spec

> **Audience: AI coding agents.** This is the source of truth for *what* Jagdampel is and *why* the
> decisions were made. Read it before implementing. When a decision changes, change it here first.
> Keep it concise and current — stale specs are worse than none.

## 1. Purpose

Jagdampel is a static website that tells German hunters, at a glance, whether a given species is
currently in season (**Jagdzeit**) in their federal state (**Bundesland**), and if not, when it opens.

**Prime question the site must answer in seconds:**
> *"Is this species open right now in my Bundesland — and if not, when will it be?"*

Everything else is secondary to answering that question fast and unambiguously.

## 2. Audience & UX principles

- Hunters, many **not digitally versed** and often on **slow rural connections / mobile in the field**.
- **Traffic-light metaphor** drives the whole UI (hence the name: *Jagd* + *Ampel*):
  - 🟢 **green** — open now (Jagdzeit)
  - 🟡 **yellow** — opens soon (within a configurable lookahead, default 30 days)
  - 🔴 **red** — closed (Schonzeit)
- Big targets, minimal text, no jargon beyond what hunters already use.
- **No accounts, no tracking, no cookies.** Fully static.
- **Accessibility:** color is never the *only* signal — always pair the traffic-light color with a
  text label and/or icon (colorblind users, bright sunlight).

## 3. Scope

### In scope
- The 16 German Bundesländer.
- Per-state, per-species hunting seasons, including **sex** (`maennlich`/`weiblich`) and **age-class**
  (e.g. `Kitz`, `Kalb`, `Schmalreh`) distinctions — these genuinely differ in German law, especially
  for Schalenwild (hoofed game).
- "What's open now" view, season calendar/timeline, category filter, state selection (manual +
  geolocation), per-species detail.

### Out of scope (for now)
- Non-German regions.
- Bag limits, weapon restrictions, licensing, legal advice.
- User-submitted data at runtime (contributions happen via Git PRs).
- Any server-side component.

> ⚠️ **Legal/safety note:** Jagdzeiten are set per Bundesland by *Landesjagdverordnungen* and can change
> by year. Jagdampel is an **orientation aid, not a legal source.** Every page must carry a disclaimer
> pointing users to the official Landesjagdverordnung. Until verified real data is supplied, all
> shipped season data is **clearly-labeled stub data** and must not be presented as authoritative.

## 4. Tech stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 6** (`output: 'static'`) | Ships zero JS by default; hydrate only interactive islands. Ideal for content-heavy + a few widgets on slow connections. |
| Interactive islands | **React 19** via `@astrojs/react` 5 | Map, filters, geolocation as isolated islands. |
| Styling | **Tailwind v4** via `@tailwindcss/postcss` (`postcss.config.mjs`) | Utility-first; theme tokens (incl. `jagd-*` colors) defined in `src/styles/global.css` `@theme`. **Note:** v4 dropped the `@astrojs/tailwind` integration — do not reintroduce it. We use the **PostCSS** plugin, *not* `@tailwindcss/vite`: Astro 6's default rolldown-vite bundler is incompatible with the Tailwind Vite plugin (`Missing field tsconfigPaths`, withastro/astro#16542). Do not switch back to the Vite plugin until that's fixed upstream. |
| Map | **Leaflet** + Bundesländer GeoJSON | Free, no API key, lightweight choropleth. |
| Geolocation → state | Browser Geolocation API + **`@turf/boolean-point-in-polygon`** | Point-in-polygon against the GeoJSON, fully client-side, no external geocoding call. Graceful fallback to manual selection. |
| Hosting | **GitHub Pages** via Actions | `site: https://captainstandby.github.io`, `base: /jagdampel`. |

**Hard constraints:**
- Must build to fully static output (`astro build` → `dist/`).
- Honor the `/jagdampel` base path in all internal links and asset URLs (use Astro's `base`-aware
  helpers; never hardcode `/`).
- Keep client JS minimal — every island must justify its bytes.

## 5. Data model

**Two layers, merged at render time** — federal law is the nationwide default; each state regulation
only writes *deviations* from it. Duplicating federal seasons into all 16 states would be a maintenance
nightmare, so we don't.

- `data/federal.json` — the **base layer**: nationwide BJagdZeitV defaults, one entry per
  `(species, class)`. Regulation "Sammeleinträge" (e.g. *Dam- und Sikawild*, the duck/goose/gull
  groups, *Stein- und Baummarder*) are **split into individual species** so state deltas can target
  them.
- `data/states/<code>.json` — a **delta layer**: only the state's overrides, Landesrecht additions,
  and *ganzjährige Schonungen* (`closed`).
- `mergeSeasons(federal, state)` in `src/lib/seasons.ts` produces the **effective** seasons for a
  state. Both files validate against `data/schema.json`.

```jsonc
// data/states/sh.json — deltas only
{
  "state": "SH",                       // two-letter code, matches GeoJSON feature property
  "name": "Schleswig-Holstein",
  "source": { "regulation": "…", "asOf": "2026-05-30" },   // citation for the disclaimer
  "seasons": [
    {
      "species": "Rotwild",            // German name exactly as in the regulation
      "class": "Kälber",               // age/sex class wording, or null for whole species
      "type": "range",                 // "range" | "year-round" | "closed"
      "periods": [                     // 1+ ranges (range only); >1 = disjoint seasons
        { "start": "08-01", "end": "01-31" }   // MM-DD inclusive
      ],
      "conditional": false,            // true = open only under legal restrictions
      "conditionNotes": null,          // the restriction wording when conditional
      "notes": "…"                     // verbatim regulation wording + caveats
    }
    // Rotwild "Hirsche und Alttiere" is NOT here — it carries through from federal.json.
  ]
}
```

### Merge semantics
- Identity is **`(species, class)`**. A state entry **replaces** the federal entry with the same
  identity (an *override*); a state entry with a new identity is an *addition*; untouched federal
  entries carry through unchanged.
- `mergeSeasons` stamps each effective entry with **`provenance: "state" | "federal"`** so the UI /
  disclaimer can show where a season comes from. This field lives only on the merged output, never in
  the source files.
- A **class-level `closed`** entry is an *exception* carved out of a species' broader (`class: null`)
  season. Example: federal *Fasanen* is open and unsexed; SH adds *Fasanen / Hennen → closed*, so the
  effective picture is "Fasan open, hens protected" (i.e. only cocks huntable). The renderer must
  prefer the most specific entry when answering about a class.

### Conventions
- **`type` distinguishes three cases** the law actually produces:
  - `range` — open during `periods` (the normal case).
  - `year-round` — *ganzjährig* huntable (e.g. Schwarzwild, Nutria); `periods` empty.
  - `closed` — *ganzjährige Schonzeit*, listed as huntable but with no open season (e.g. Wölfe, Elstern); `periods` empty.
- **`periods` is an array** — a single animal/class can have **disjoint seasons** (e.g. Schmaltiere
  `05-01`–`05-31` *und* `09-01`–`01-31`). Each period is its own `{start,end}`.
- **Dates are `MM-DD` only** — seasons recur yearly; no specific year is stored. A period **wraps the
  year boundary** when `end < start` (e.g. `07-01`–`02-28`). Status logic must handle wrap-around.
- **`02-28`** is stored verbatim as the law writes it ("28. Februar"); the regulation does not write
  "29. Februar" in leap years. Treat as end-of-February. (Revisit if precise leap handling is needed.)
- **`class`** holds the German hunting term verbatim (`Hirsche und Alttiere`, `Böcke`, `Schmaltiere`,
  `Kälber`, `Jungfüchse`, `Hähne`, `Hennen`). These encode sex *and* age together; kept as one string
  rather than split into `sex`/`age` to stay faithful and simple. Split later if the UI needs it.
- **`provenance`** (merged output only) records `state` vs `federal` — see merge semantics above.
- **`conditional`** marks seasons that are open only under legal restrictions (e.g. Nonnengänse — only
  for Vergrämung/Schadensabwehr outside Vogelschutzgebiete). The traffic-light UI **must** show these
  distinctly from a plain 🟢.
- **No `category` field (yet).** The regulations use no game categories; we deferred classification to
  keep the base schema simple and add it back once it's grounded (§3, §10).
- `state` codes use the standard German abbreviations: BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL,
  SN, ST, SH, TH.

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
/                         Home: state selector (geolocation + manual) → "what's open now" for that state
/state/[code]             Per-state: full species list with traffic-light status + season timeline
                          (Category filter deferred — see §3/§10)
/species/[slug]           (later) Cross-state view of one species
```

Home must work with **zero interaction** beyond (optionally) granting geolocation: land → see your
state's open species. Manual state pick is always available and is the fallback when geolocation is
denied or unavailable.

## 7. Planned components (React islands unless noted)

| Component | Role |
|---|---|
| `StateSelector` | Manual dropdown + "use my location" button (Geolocation → Turf point-in-polygon). |
| `GermanyMap` | Leaflet choropleth; click a state to navigate. Optional on home, primary as overview. |
| `SeasonStatusBadge` | The traffic-light badge: color + label + icon. Pure, reused everywhere. Must render the "open with restrictions" state for `conditional` seasons. |
| `SeasonTimeline` | Year-long horizontal calendar bar per species, with per-`class` sub-rows shaded by each open period (handles multiple disjoint periods). The "multidimensional calendar". |
| `CategoryFilter` | Deferred until categories are reintroduced (§3/§10). |
| `Disclaimer` | Legal disclaimer + link to official source (`source` field). Present site-wide. |

Shared, framework-agnostic logic lives in `src/lib/` as plain TS so both `.astro` and `.tsx` can
import it. Already present: `seasons.ts` (`Season`/`Period`/`SeasonsFile` types + the pure
`mergeSeasons(federal, state)`). Still to add: status computation + date math (§5), data loading.

## 8. Data maintenance

- **Edit federal once, states stay thin.** A nationwide change is a one-line edit in
  `data/federal.json`; a state file only ever holds that state's deviations.
- Real Jagdzeiten are added/corrected via **Git PRs**, validated against `data/schema.json`.
- Build should (eventually) fail if `data/federal.json` or any `data/states/*.json` violates the schema
  **or if `mergeSeasons` produces a contradiction** — wrong dates are a safety problem, so validation
  is a gate, not a warning.
- GeoJSON lives in `public/geo/` (see its README); use a **simplified** resolution.

## 9. Current status (2026-05-30)

**Done:**
- Astro + React + Tailwind v4 toolchain, pinned & building.
- GitHub Pages deploy workflow.
- `data/schema.json` for the layered model (federal base + state deltas).
- **`data/federal.json`** — nationwide BJagdZeitV base layer (56 entries, combined entries split).
- **`data/states/sh.json`** — Schleswig-Holstein deltas (52 entries) — see §10.
- **`src/lib/seasons.ts`** — types + pure `mergeSeasons`. Verified: SH merges to 69 effective seasons
  (42 range, 7 year-round, 20 closed; 52 state, 17 federal carried through).

**Not yet built:**
- Components in §7, status/date library, the GeoJSON asset, schema + merge validation in the build,
  the remaining 15 states, an automated test runner (merge is currently verified by an ad-hoc script).

**Open questions for the human:**
1. Lookahead window for "soon" (default 30 days — confirm).
2. Whether the map is on the home page or a separate overview.
3. Per-state **presence** filtering (see §10, item 4): federal seasons now flow to every state, so
   Gams-/Muffelwild etc. appear in SH. Confirm we leave them (legally correct) or add an optional
   per-state "not present" suppression list later.

## 10. Schleswig-Holstein data — provenance & decisions

Effective SH seasons = `data/federal.json` overlaid with `data/states/sh.json` via `mergeSeasons`.
Sources are in each file's `source` block. **This is an orientation aid, not legal advice** — the
human must verify against the official Landesjagdverordnung before it is trusted.

**Counts:** federal base 56 entries; SH deltas 52; **effective 69** (42 `range`, 7 `year-round`,
20 `closed`; 52 from `state`, 17 from `federal`).

**Decisions / inferences that need human verification:**
1. **Federal carryovers** (17 effective entries with `provenance: "federal"`): adult Schalenwild SH
   doesn't deviate (Rotwild/Dam-/Sikawild *Hirsche und Alttiere*; Rehwild *Ricken*), Schwarzwild
   (ganzjährig), Stein-/Baummarder, Stockenten, Krick-/Reiherenten, Waldschnepfen, **Silbermöwen**
   (SH protects the other four gull species but not this one), Gams-/Muffelwild, etc.
2. **Fasan exception (confirmed correct by human):** federal *Fasanen* is open and unsexed; SH protects
   only *Fasanenhennen*. Modelled as federal *Fasanen* (open) + state *Fasanen / Hennen* (`closed`),
   i.e. only cocks huntable.
3. **Combined federal entries split** so deltas can target them: *Dam-/Sikawild*, *Stein-/Baummarder*,
   the duck group, the goose group, the gull group, *Ringel-/Türkentauben*. SH then overrides or
   protects individual species (e.g. Pfeifente kept open, Spieß-/Berg-/Tafel-/Samt-/Trauerente closed).
4. **Scoping is now handled by the merge, not by hand-exclusion.** Every federal season flows into SH
   unless SH overrides it — so Muffelwild (correctly) appears. Species with **no** federal season
   (Wisent, Elch, Steinwild, Schneehase, Luchs, Wildkatze, Seehund, Fischotter, Wolf*, Wachtel,
   Auer-/Birk-/Haselwild, Großtrappe, …) simply never enter `federal.json` and so don't appear.
   *(Wolf appears only as SH `closed`.) Open question 3 covers whether to suppress federally-listed but
   locally-absent species per state.
5. **`02-28`** kept verbatim per the law (no leap-day handling).
6. **§2(3) Deich-area year-round override** (Wildkaninchen, Füchse, Dachse, Nutria on
   Deichkörper/Warften) is captured in `notes`, not as separate season rows.
