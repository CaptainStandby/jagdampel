# Jagdampel data model — reference for importers

The authoritative spec is `DESIGN_SPEC.md` in the repo root (§5 data model, §10 provenance).
This file is the working reference for an *import*: the shape, the merge, and the catalogue of
real-world legal patterns we have already hit and how to encode each one.

## The three artefacts

- **`data/taxonomy.json`** — registry of every species under the Jagdrecht, keyed by a stable ascii
  `speciesKey`, with a canonical `label` and its class *atoms* (`classes`). Single source of truth
  for the universal merge key, for whole→atom expansion, and (later) for filter tags. `classes` is
  `{}` for species the law never splits by age/sex.
- **`data/federal.json`** — the base layer: the complete § 2 BJagdG roster. Species with a
  Bundesjagdzeit get `range`/`year-round`; species with none are `closed`.
- **`data/states/<code>.json`** — a *delta*: only what the state changes from federal.
- `mergeSeasons(federal, state, taxonomy)` in `src/lib/seasons.ts` overlays them.

## Season entry shape

```jsonc
{
  "key": "reh/ricke",        // taxonomy speciesKey, optionally /classKey. THE match key.
  "type": "range",           // "range" | "year-round" | "closed"
  "periods": [               // range only; >1 entry = disjoint seasons; wraps year when end < start
    { "start": "09-01", "end": "01-31" }   // MM-DD inclusive
  ],
  "conditional": false,      // open only under restrictions (Maßgabe / permit) — UI shows distinctly
  "conditionNotes": null,    // the restriction wording, required when conditional
  "notes": "…"               // VERBATIM regulation wording + caveats. This is where the German lives.
}
```

`provenance` (`state` | `federal`) is **stamped by the merge**, never stored in a file.

## How the merge works (why the key matters)

1. **Resolve each layer** against the taxonomy. A **whole-species** entry (bare key, no `/`) for a
   species the taxonomy splits is **expanded into one entry per atom**, inheriting the season.
   Explicit class entries are applied last, so they override expansions.
2. **Overlay**: state entries replace federal entries with the same `key`; new keys are additions;
   untouched federal entries carry through.

This is what lets a state be a sparse delta (SH omits adult deer → filled by federal) *or* a near
full restatement (Bavaria) with one rule. It also reconciles layers that slice a species
differently: federal whole `dachs` → `dachs/adult` + `dachs/juvenil`, which a state's per-age
entries then replace; federal unsexed `fasan` → `fasan/hahn` + `fasan/henne`, so a state can close
only `fasan/henne`.

**Consequence for you:** matching is on the canonical key, *never* on German wording. Different
states call the same class different things — normalise to the key, keep the verbatim term in `notes`.

## The cardinal rules of an import

- **Thin delta.** Only write entries that *differ* from federal. Diff every extracted season against
  `data/federal.json`; if the dates/type match, omit it — the merge inherits it. (Bavaria's § 19 is a
  complete list, yet its delta is 33 entries because most match federal.)
- **Don't guess.** Wrong hunting dates are a safety/legal problem. If a class, date, or mapping is
  unclear, leave it out and *flag it for the human* — never invent. The subagent contract enforces
  this; preserve it through reconciliation.
- **Verbatim → `notes`, canonical → `key`.** Always keep the law's exact wording so a human can
  verify.
- **New species or class split → taxonomy first.** Add the `speciesKey`/atoms to `data/taxonomy.json`
  before referencing them. Adding atoms to an existing species makes federal whole-entries expand for
  *every* state, so re-run the verifier across all states.

## Pattern catalogue (seen across SH / BY / HE)

| Legal wording | Encode as | Notes |
|---|---|---|
| open date span "vom X bis Y" | `range` + one period | end < start wraps the year (e.g. `07-01`→`02-28`) |
| two spans "X bis Y **und** A bis B" | `range` + two `periods` | one entry per disjoint window |
| "ganzjährig" **in a Jagdzeit table** | `year-round` | means huntable all year (Schwarzwild, neozoa) |
| "ganzjährig geschont" / "keine Jagdzeit" | `closed` | no open season; the species is still listed |
| sex/age class ("Böcke", "Geißen", "Kälber", "adulte/juvenile …") | classed key `species/atom` | map the verbatim term to its taxonomy atom; add the atom if new |
| federal *combines* classes ("Hirsche und Alttiere") | author each atom separately | so a state that splits them can override per atom |
| law *groups* species ("Dam- und Sikawild", duck/goose/gull lists) | one entry per species | split into individual `speciesKey`s |
| population/spatial Maßgabe ("zu verschonen in …", density quota) | `range` + `conditional:true` + `conditionNotes` | season is open but restricted; spatial detail stays free text |
| permit-only ("nur soweit eine Ausnahme/Befreiung zulässt", no dates) | `range` + `conditional:true` + **empty `periods`** + `conditionNotes` | Bavaria Fischotter/Wolf. Status logic → "not open now, only by permit" |
| state silent on a class | omit it | federal default carries through the merge |
| same wording, same dates as federal | omit it | thin delta |

### State-specific framing differences (all faithful, do not "normalise away")
- **SH** lists only deviations; relies on federal for adult deer, marten, ducks it doesn't mention.
- **Bavaria** enumerates everything in § 19; identical-to-federal entries are still omitted from the
  delta. Wolf/Fischotter are permit-only `conditional`.
- **Hessen** writes "keine Jagdzeit" for many species (closes most waterfowl incl. all gulls), uses
  "ganzjährig" for neozoa (year-round huntable), and handles wolves via a separate § 2a exemption
  provision that is **not a season** → wolf stays `closed`.

## Deferred / known gaps (don't silently drop — flag in the state file's `source.deferred`)

- **Stacked "regime" seasons.** A few states add an *extra* season for an animal under a separate
  legal basis on top of its base season (Bavaria: Ringeltauben damage-control windows; the July
  window for sitting juvenile Grau-/Kanadagänse). The model has no concept for two independent
  seasons on one key yet. Omit and flag.
- **Spatial restrictions** (Natura-2000 zones, distance buffers) live only as free text in
  `conditionNotes` — not machine-structured.
- **Leap day**: `02-28` is stored verbatim per the law; no 29-Feb handling.

> Distinguish a *clean age-class season* (e.g. Hessen "juvenile Ringeltauben 1.7.–10.2." — a single
> season for the `jung` atom → model it) from a *stacked regime* (Bavaria's conditional damage-control
> window *on top of* the base season → defer it). The first fits; the second doesn't yet.
