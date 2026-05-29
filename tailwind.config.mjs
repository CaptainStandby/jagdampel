/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        jagd: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          forest: '#1a3a2a',
        },
      },
    },
  },
  plugins: [],
};
