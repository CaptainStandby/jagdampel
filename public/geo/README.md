# GeoJSON for German federal state boundaries

Place the German Bundesländer GeoJSON file here (e.g. `germany-states.geojson`).

It is consumed for two purposes:

1. **Choropleth map** of the 16 Bundesländer (Leaflet).
2. **Geolocation → state** detection via point-in-polygon (`@turf/boolean-point-in-polygon`),
   so the user's current state can be pre-selected with no external API call.

## Source

- <https://github.com/isellsoap/deutschlandGeoJSON> (Bundesländer, several resolutions)

## Requirements

- Each feature must expose the state's two-letter code (`BY`, `NW`, `NI`, …) in its
  `properties`, matching the `state` field in `data/states/*.json`. Normalize the
  property name on load if the source uses a different key.
- Prefer a **simplified** resolution (≈1–4 MB) — hunters in the field are often on slow
  connections, and polygon precision beyond state borders is wasted bytes.
