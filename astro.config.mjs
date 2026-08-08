import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// process.env is correct here — import.meta.env is not available at config-load time.
const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  site: "https://jagdampel.de",
  integrations: [react()],
  output: "static",
  markdown: {
    // Shiki (default) injects inline styles incompatible with CSP.
    // This site has no syntax-highlighted code blocks, so disable it.
    syntaxHighlight: false,
  },
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
        // 'self' covers <style>/<link> elements (style-src).
        // 'unsafe-inline' scoped to "attribute" covers React style={} props
        // (style-src-attr). 'self' is intentionally not duplicated into
        // attribute scope — it has no meaning for inline style attributes.
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
