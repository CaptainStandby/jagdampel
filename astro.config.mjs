import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://jagdampel.de",
  integrations: [react()],
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
