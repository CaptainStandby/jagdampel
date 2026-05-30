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

One JSON file per state in `data/states/<code>.json`, validated against `data/schema.json`.

```jsonc
{
  "state": "BY",            // two-letter code, matches GeoJSON feature property
  "name": "Bayern",
  "seasons": [
    {
      "species": "Rehbock",            // German common name of the species/class
      "category": "Schalenwild",       // Schalenwild | Raubwild | Federwild | Niederwild
      "sex": "maennlich",              // "maennlich" | "weiblich" | null (both)
      "age": null,                     // e.g. "Kitz", "Kalb", "Schmalreh"; null = all ages
      "start": "05-01",                // MM-DD, inclusive
      "end": "10-15",                  // MM-DD, inclusive
      "notes": "…"                     // optional caveats / source remarks
    }
  ]
}
```

### Conventions
- **Dates are `MM-DD` only** — seasons recur yearly; no specific year is stored.
- A season **wraps the year boundary** when `end < start` (e.g. fox `08-15`–`02-28`). Status logic
  must handle wrap-around.
- `02-28` is used as the conventional end-of-February marker (avoids leap-year ambiguity). Treat the
  whole of Feb 28/29 as in-season.
- One `(species, sex, age)` triple = one row. The same species appears as multiple rows when sexes or
  age classes have different seasons. The UI groups rows by `species` and shows the sex/age breakdown.
- `state` codes use the standard German abbreviations: BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL,
  SN, ST, SH, TH.

### Status computation (define once, reuse everywhere)
Given "today" in **Europe/Berlin** timezone and a season:
- **open** if today ∈ [start, end] (wrap-aware).
- **soon** if not open and the next start is within the lookahead window (default 30 days).
- **closed** otherwise.

## 6. Information architecture

```
/                         Home: state selector (geolocation + manual) → "what's open now" for that state
/state/[code]             Per-state: full species list with traffic-light status + season timeline
                          Category filter (Schalenwild / Raubwild / Federwild / Niederwild)
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
| `SeasonStatusBadge` | The traffic-light badge: color + label + icon. Pure, reused everywhere. |
| `SeasonTimeline` | Year-long horizontal calendar bar per species, with sex/age sub-rows shaded by open period. The "multidimensional calendar". |
| `CategoryFilter` | Toggle game categories. |
| `Disclaimer` | Legal disclaimer + link to official source. Present site-wide. |

Shared, framework-agnostic logic (status computation, date math, data loading/typing) lives in
`src/lib/` as plain TS so both `.astro` and `.tsx` can import it.

## 8. Data maintenance

- Real Jagdzeiten are added/corrected via **Git PRs**, validated against `data/schema.json`.
- Build should (eventually) fail if any `data/states/*.json` violates the schema — wrong dates are a
  safety problem, so validation is a gate, not a warning.
- GeoJSON lives in `public/geo/` (see its README); use a **simplified** resolution.

## 9. Current status (2026-05-30)

**Done (bootstrap):**
- Astro + React + Tailwind v4 toolchain, pinned & building.
- GitHub Pages deploy workflow.
- Data schema + one stub state (`data/states/example-bayern.json`, clearly labeled).
- This spec.

**Not yet built (deliberately deferred until spec sign-off):**
- All components in §7, the status/date library, real per-state data, the GeoJSON asset, schema
  validation in the build.

**Open questions for the human:**
1. Final schema shape before real data is poured in (the user will refine it and supply real data).
2. Lookahead window for "soon" (default 30 days — confirm).
3. Whether the map is on the home page or a separate overview.
