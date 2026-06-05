// Build internal links that respect the configured `base` (/jagdampel) without
// caring whether BASE_URL carries a trailing slash. Never hardcode "/".
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Base-aware href. `href("state/sh")` → "/jagdampel/state/sh"; `href()` → "/jagdampel/". */
export const href = (path = ""): string => `${BASE}/${path.replace(/^\//, "")}`;
