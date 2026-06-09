#!/usr/bin/env node
// Unit tests for src/lib/filters.ts (tag AND-matching + diacritic-insensitive search).
// Run from repo root:  node scripts/test-filters.mjs   (or: npm test)
// Node 24 strips TS types, so we import the .ts module directly.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/filters.ts")).href
);
const { matchesTags, matchesSearch, normalizeText } = mod;

let failures = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(
      `✗ ${name}\n    expected ${expected}\n    actual   ${actual}`,
    );
  }
}
const set = (...x) => new Set(x);

// --- matchesTags: empty selection passes everything ---
check("no selection passes", matchesTags(["niederwild"], set()), true);

// --- matchesTags: single tag (AND == OR for one) ---
check(
  "single tag match",
  matchesTags(["schalenwild", "neozoen"], set("schalenwild")),
  true,
);
check(
  "single tag non-match",
  matchesTags(["federwild"], set("schalenwild")),
  false,
);

// --- matchesTags: AND semantics for 2+ tags ---
check(
  "AND both present",
  matchesTags(
    ["schalenwild", "hochwild", "neozoen"],
    set("schalenwild", "neozoen"),
  ),
  true,
);
check(
  "AND one missing",
  matchesTags(["schalenwild"], set("schalenwild", "neozoen")),
  false,
);
check(
  "AND none present",
  matchesTags(["federwild", "wasserwild"], set("schalenwild", "neozoen")),
  false,
);

// --- matchesSearch: diacritic/case-insensitive substring ---
check("empty query passes", matchesSearch("Graugänse", ""), true);
check("gans → Graugänse", matchesSearch("Graugänse", "gans"), true);
check("loffel → Löffelente", matchesSearch("Löffelente", "loffel"), true);
check("case-insensitive", matchesSearch("Wildschwein", "WILD"), true);
check("non-match", matchesSearch("Fuchs", "ente"), false);

// --- normalizeText ---
check(
  "normalizeText folds ä + lowercases",
  normalizeText("Graugänse"),
  "grauganse",
);

if (failures) {
  console.error(`\n✗ ${failures} test(s) failed`);
  process.exit(1);
}
console.log("\n✓ all filters tests pass");
