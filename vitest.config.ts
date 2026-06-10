/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// getViteConfig merges Astro's resolved Vite config into the test run, so tests
// see the same pipeline as the build: import.meta.glob, import.meta.env, JSON
// imports, path resolution, TS via esbuild. That's what lets us test data.ts
// (glob over data/states/*.json) and paths.ts (BASE_URL) — impossible under
// plain Node.
export default getViteConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
});
