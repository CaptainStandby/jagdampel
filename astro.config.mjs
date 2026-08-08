import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  site: "https://jagdampel.de",
  integrations: [react()],
  output: "static",
  security: {
    csp: {
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        ...(isProd ? { "upgrade-insecure-requests": [] } : {}),
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
