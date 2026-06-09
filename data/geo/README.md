# Bundesländer boundary GeoJSON (build input)

`bundeslaender.geojson` is the simplified boundary set for the 16 German Bundesländer.

## Use

It is a **build input only** for the homepage map: `scripts/build-germany-svg.mjs` projects it into
`src/lib/geo/germany-states.ts` (committed SVG path data). The GeoJSON itself is **not** shipped to the
browser for the map.

(The separate geolocation feature, #38, will ship a client-side GeoJSON from `public/geo/` for
point-in-polygon — that is a different copy and not used yet.)

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

The map is plain inline SVG — no Leaflet. `leaflet`/`@types/leaflet` were removed from `package.json`;
`@turf/*` is kept for the planned geolocation feature (#38).
