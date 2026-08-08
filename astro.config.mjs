import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const isProd = import.meta.env.PROD;

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
        ...(isProd ? ["upgrade-insecure-requests"] : []),
      ],
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
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
