#!/usr/bin/env node
// Unit tests for label resolution (src/lib/seasons.ts).
//
// Run from the repo root:  node scripts/test-seasons.mjs  (or: npm test)
//
// Node 24 strips the TS types, so we import the .ts module directly — same trick
// the other test scripts use. Exits non-zero on any failure, so it gates commits.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/seasons.ts")).href
);
const { effectiveClassLabel } = mod;

const taxonomy = {
  species: {
    reh: {
      label: "Rehwild",
      classes: { ricke: { label: "Ricken" }, kitz: { label: "Kitze" } },
    },
    schwarzwild: { label: "Schwarzwild", classes: {} },
  },
};

let failures = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(
      `✗ ${name}\n    expected: ${expected}\n    actual:   ${actual}`,
    );
  }
}

// A state's regional term overrides the canonical class label.
check(
  "term overrides canonical class label",
  effectiveClassLabel(
    { key: "reh/ricke", type: "range", term: "Geißen" },
    taxonomy,
  ),
  "Geißen",
);

// Without a term, the canonical taxonomy label is used.
check(
  "canonical class label when no term",
  effectiveClassLabel({ key: "reh/ricke", type: "range" }, taxonomy),
  "Ricken",
);

// Whole-species seasons have no class label (term does not apply).
check(
  "whole-species season has no class label",
  effectiveClassLabel({ key: "schwarzwild", type: "range" }, taxonomy),
  null,
);

// Unknown class falls back to the raw class key (mirrors classLabel).
check(
  "unknown class key falls back to the key",
  effectiveClassLabel({ key: "reh/unbekannt", type: "range" }, taxonomy),
  "unbekannt",
);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nall seasons label tests passed");
