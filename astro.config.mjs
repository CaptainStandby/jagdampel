import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://captainstandby.github.io',
  base: '/jagdampel',
  integrations: [react()],
  output: 'static',
});
