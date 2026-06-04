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
- "What's open now" view, season calendar/timeline, category filter, state selection (manual +
  geolocation), per-species detail.

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

| Layer               | Choice                                                            | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Astro 6** (`output: 'static'`)                                  | Ships zero JS by default; hydrate only interactive islands. Ideal for content-heavy + a few widgets on slow connections.                                                                                                                                                                                                                                                                                                                                      |
| Interactive islands | **React 19** via `@astrojs/react` 5                               | Map, filters, geolocation as isolated islands.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Styling             | **Tailwind v4** via `@tailwindcss/postcss` (`postcss.config.mjs`) | Utility-first; theme tokens (incl. `jagd-*` colors) defined in `src/styles/global.css` `@theme`. **Note:** v4 dropped the `@astrojs/tailwind` integration — do not reintroduce it. We use the **PostCSS** plugin, _not_ `@tailwindcss/vite`: Astro 6's default rolldown-vite bundler is incompatible with the Tailwind Vite plugin (`Missing field tsconfigPaths`, withastro/astro#16542). Do not switch back to the Vite plugin until that's fixed upstream. |
| Map                 | **Leaflet** + Bundesländer GeoJSON                                | Free, no API key, lightweight choropleth.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Geolocation → state | Browser Geolocation API + **`@turf/boolean-point-in-polygon`**    | Point-in-polygon against the GeoJSON, fully client-side, no external geocoding call. Graceful fallback to manual selection.                                                                                                                                                                                                                                                                                                                                   |
| Hosting             | **GitHub Pages** via Actions                                      | `site: https://captainstandby.github.io`, `base: /jagdampel`.                                                                                                                                                                                                                                                                                                                                                                                                 |

**Hard constraints:**

- Must build to fully static output (`astro build` → `dist/`).
- Honor the `/jagdampel` base path in all internal links and asset URLs (use Astro's `base`-aware
  helpers; never hardcode `/`).
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
/                         Home: state selector (geolocation + manual) → "what's open now" for that state
/state/[code]             Per-state: full species list with traffic-light status + season timeline
                          (Category filter deferred — see §3/§10)
/species/[slug]           (later) Cross-state view of one species
```

Home must work with **zero interaction** beyond (optionally) granting geolocation: land → see your
state's open species. Manual state pick is always available and is the fallback when geolocation is
denied or unavailable.

## 7. Planned components (React islands unless noted)

| Component           | Role                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StateSelector`     | Manual dropdown + "use my location" button (Geolocation → Turf point-in-polygon).                                                                                         |
| `GermanyMap`        | Leaflet choropleth; click a state to navigate. Optional on home, primary as overview.                                                                                     |
| `SeasonStatusBadge` | The traffic-light badge: color + label + icon. Pure, reused everywhere. Must render the "open with restrictions" state for `conditional` seasons.                         |
| `SeasonTimeline`    | Year-long horizontal calendar bar per species, with per-`class` sub-rows shaded by each open period (handles multiple disjoint periods). The "multidimensional calendar". |
| `CategoryFilter`    | Deferred until categories are reintroduced (§3/§10).                                                                                                                      |
| `Disclaimer`        | Legal disclaimer + link to official source (`source` field). Present site-wide.                                                                                           |

Shared, framework-agnostic logic lives in `src/lib/` as plain TS so both `.astro` and `.tsx` can
import it. Already present: `seasons.ts` — `Season`/`Period`/`Taxonomy` types, the pure
`mergeSeasons(federal, state, taxonomy)`, and `speciesLabel`/`classLabel` helpers. Still to add:
status computation + date math (§5), data loading.

## 8. Data maintenance

- **Edit federal once, states stay thin.** A nationwide change is a one-line edit in
  `data/federal.json`; a state file only holds that state's deviations.
- **New species or class split → taxonomy first.** Add the `speciesKey`/atoms to `data/taxonomy.json`,
  then reference it from the season files. Filter `tags` (Hochwild/Niederwild/…) will live here too.
- Real Jagdzeiten are added/corrected via **Git PRs**, validated against `data/schema.json`.
- Build should (eventually) fail if any data file violates the schema, references a `key` absent from
  the taxonomy, or `mergeSeasons` produces a contradiction — wrong dates are a safety problem, so
  validation is a gate, not a warning. (Currently verified by an ad-hoc script; needs a test runner.)
- GeoJSON lives in `public/geo/` (see its README); use a **simplified** resolution.

## 9. Current status (2026-06-01)

**Done:**

- Astro + React + Tailwind v4 toolchain, pinned & building.
- GitHub Pages deploy workflow.
- `data/schema.json` for the keyed model; `data/taxonomy.json` (83 species registry).
- **`data/federal.json`** — complete § 2 BJagdG roster (82 entries; no-season species as `closed`).
- **`data/states/{sh,by,he}.json`** — Schleswig-Holstein (50), Bavaria (33), Hessen (58) deltas.
- **`src/lib/seasons.ts`** — types + pure `mergeSeasons` (taxonomy-driven, whole→atom expansion).
  Verified: SH → 98 effective (49 range / 7 year-round / 42 closed; 46 federal / 52 state);
  BY → 99 (69 / 10 / 20; 65 / 34); HE → 103 (44 / 15 / 44; 45 / 58).

**Not yet built:**

- Components in §7, status/date library, the GeoJSON asset, schema/taxonomy/merge validation in the
  build, the remaining 13 states, an automated test runner.

**Open questions for the human:**

1. Lookahead window for "soon" (default 30 days — confirm).
2. Whether the map is on the home page or a separate overview.
3. Per-state **presence** filtering: federal seasons flow to every state, so a species federally
   huntable but locally absent (e.g. Gamswild in SH) appears. Leave it (legally correct) or add an
   optional per-state suppression list later?
4. The deferred **regime** concept (§5) — when to model stacked damage-control seasons.

## 10. Data provenance & decisions

Effective seasons = `data/federal.json` overlaid with a state delta via `mergeSeasons`. Sources are in
each file's `source` block. **This is an orientation aid, not legal advice** — verify against the
official regulation before trusting it.

**Cross-cutting decisions:**

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
