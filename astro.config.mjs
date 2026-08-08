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
        "base-uri 'self'",
        "object-src 'none'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "upgrade-insecure-requests",
      ],
      styleDirective: {
        resources: [
          "'self'",
          { resource: "'unsafe-inline'", kind: "attribute" },
        ],
      },
      scriptDirective: {
        resources: ["'self'"],
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
