import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://captainstandby.github.io',
  base: '/jagdampel',
  integrations: [react(), tailwind()],
  output: 'static',
});
