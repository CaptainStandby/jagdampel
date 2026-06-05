import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import prettier from "eslint-config-prettier/flat";

export default [
  { ignores: ["dist/", ".astro/", ".claude/", "data_to_import/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // Node scripts (test runner, tooling) — give them the Node globals.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  // Must be last: turns off every rule Prettier already handles.
  prettier,
];
