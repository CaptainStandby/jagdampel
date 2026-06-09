# Bundesländer boundary GeoJSON (build input)

`bundeslaender.geojson` is the simplified boundary set for the 16 German Bundesländer.

## Use

It is a **build input only** for the homepage map: `scripts/build-germany-svg.mjs` projects it into
`src/lib/geo/germany-states.ts` (committed SVG path data). The GeoJSON itself is **not** shipped to the
browser.

## Source & licence

- <https://github.com/isellsoap/deutschlandGeoJSON> — `2_bundeslaender/4_niedrig.geo.json`.
- Underlying data © GeoBasis-DE / BKG (Verwaltungsgebiete), dl-de/by-2-0. Confirm the upstream LICENSE
  before redistribution.

## Regenerating

```
node scripts/build-germany-svg.mjs
```

Each feature must expose its ISO code in `properties.id` (`DE-BY`, …); the generator asserts 16
features and a `DE-XX` id, and fails fast otherwise.

## Note

The map is plain inline SVG — no Leaflet, no client-side geo libs. `leaflet`/`@types/leaflet` and the
`@turf/*` packages have been removed from `package.json` (the latter were reserved for the dropped
geolocation feature, #38).
