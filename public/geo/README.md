# public/geo — client GeoJSON (reserved for geolocation, #38)

This directory is reserved for a **client-shipped** Bundesländer GeoJSON used by the planned
geolocation feature (#38): browser Geolocation + `@turf/boolean-point-in-polygon` to locate the
visitor's Bundesland. It is **not used yet** and is currently empty.

The homepage **map** does NOT use this: it renders inline SVG generated at build time from
`data/geo/bundeslaender.geojson` (see `data/geo/README.md`). No Leaflet.

## When you add the geolocation GeoJSON here

- Use a **simplified** resolution (≈1–4 MB) — hunters are often on slow connections.
- Each feature must expose the two-letter code (`BY`, `NW`, …) matching the `state` field in
  `data/states/*.json`. Normalize the property name on load if the source uses a different key.
- Source: <https://github.com/isellsoap/deutschlandGeoJSON>.
