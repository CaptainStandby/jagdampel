import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://jagdampel.de",
  integrations: [react()],
  output: "static",
});
