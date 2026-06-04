import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import prettier from "eslint-config-prettier/flat";

export default [
  { ignores: ["dist/", ".astro/", ".claude/", "data_to_import/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // Must be last: turns off every rule Prettier already handles.
  prettier,
];
