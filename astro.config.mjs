import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://jagdampel.de",
  integrations: [react()],
  output: "static",
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'"
      ],
      styleDirective: {
        resources: [
          { resource: "'unsafe-inline'", kind: "attribute" }
        ]
      }
    }
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
