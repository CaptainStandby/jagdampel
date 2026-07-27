# Jagdampel

**Jagdzeiten auf einen Blick** — a static website that tells German hunters, at a glance, whether a
species is currently in season (_Jagdzeit_) in their federal state (_Bundesland_), and if not, when it
opens.

🌐 **[jagdampel.de](https://jagdampel.de)**

The name is _Jagd_ (hunt) + _Ampel_ (traffic light), which is also the whole UI metaphor:

- 🟢 **green** — open now (Jagdzeit)
- 🟡 **yellow** — opens soon (default: within 30 days)
- 🔴 **red** — closed (Schonzeit)

Built for hunters who are often not digitally versed and on slow rural connections, so the site is
fully static, ships almost no JavaScript, uses no accounts, no cookies, and no tracking. Color is never
the only signal — every status also carries a text label.

> ⚠️ **Orientation aid, not a legal source.** Jagdzeiten are set per Bundesland by
> _Landesjagdverordnungen_ and change over time. Always verify against the official regulation for your
> state. Every page carries this disclaimer.

## Tech stack

| Layer     | Choice                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Framework | [Astro](https://astro.build) (`output: 'static'`), zero JS by default                  |
| Islands   | React 19 via `@astrojs/react` for the map and interactive filters                      |
| Styling   | Tailwind CSS v4 (Vite plugin), theme tokens in `src/styles/global.css`                 |
| Map       | Inline SVG generated from Bundesländer GeoJSON — no map library, recolours client-side |
| Testing   | Vitest (unit) + Playwright (e2e)                                                       |
| Hosting   | GitHub Pages via Actions, custom domain `jagdampel.de`                                 |

See [`DESIGN_SPEC.md`](./DESIGN_SPEC.md) for the full rationale and architecture.

## Getting started

Requires **Node 24** (see `.nvmrc`).

```bash
npm install
npm run dev      # local dev server
```

| Command                 | What it does                         |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Start the dev server                 |
| `npm run build`         | Build static output to `dist/`       |
| `npm run preview`       | Preview the production build         |
| `npm test`              | Run unit tests (Vitest)              |
| `npm run test:coverage` | Unit tests with coverage             |
| `npm run test:e2e`      | Build, then run Playwright e2e tests |
| `npm run lint`          | ESLint                               |
| `npm run format`        | Prettier                             |

## Data model

Hunting seasons live in `data/` as three JSON artefacts, merged at render time so federal law isn't
duplicated across all 16 states:

- **`data/taxonomy.json`** — the species registry: stable `speciesKey`, canonical labels, class atoms
  (e.g. `reh` → `{kitz, schmalreh, ricke, bock}`), and filter tags.
- **`data/federal.json`** — the base layer: the complete § 2 BJagdG roster with nationwide default
  seasons.
- **`data/states/<code>.json`** — a delta layer per state: only that state's deviations from federal law.

`mergeSeasons()` in `src/lib/seasons.ts` overlays them into the effective seasons. Everything validates
against `data/schema.json`. Adding a `data/states/xx.json` file is enough to publish a state — there is
no registry to maintain.

Full data-model documentation (merge semantics, the universal key, whole→atom expansion) is in
[`DESIGN_SPEC.md`](./DESIGN_SPEC.md#5-data-model).

## Contributing state data

Season data is contributed via Git — there is no runtime submission. To add or update a state, edit its
`data/states/<code>.json` delta from the official _Landesjagdverordnung_, cite the regulation in the
`source` block, and run `npm test`. Data must be clearly sourced; unverified guesses are never published.

## Deployment

Pushing to `main` triggers the `CI & Deploy` GitHub Actions workflow: it runs the tests, builds the
static site, and deploys to GitHub Pages at `jagdampel.de`.

## License

[MIT](./LICENSE)
