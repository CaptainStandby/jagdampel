#!/usr/bin/env node
// Unit tests for the timeline segment math (src/lib/timeline.ts).
// Run: node scripts/test-timeline.mjs  (part of `npm test`)

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/timeline.ts")).href
);
const { seasonSegments, todayFraction, dayFraction } = mod;

let failures = 0;
const at = (iso) => new Date(iso);
const r2 = (n) => Math.round(n * 100) / 100;
const round = (segs) =>
  segs.map((s) => ({
    leftPct: r2(s.leftPct),
    widthPct: r2(s.widthPct),
    conditional: s.conditional,
  }));

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`✓ ${name}`);
  } else {
    failures++;
    console.error(`✗ ${name}\n    expected ${e}\n    actual   ${a}`);
  }
}

const range = (periods, extra = {}) => ({
  key: "x",
  type: "range",
  periods,
  ...extra,
});

check("dayFraction: 01-01 → 0", dayFraction("01-01"), 0);
check("dayFraction: 12-31 inclusive end → 1.0", dayFraction("12-31", true), 1);

check("closed → no segments", seasonSegments({ key: "x", type: "closed" }), []);

check(
  "year-round → full bar",
  seasonSegments({ key: "x", type: "year-round" }),
  [{ leftPct: 0, widthPct: 100, conditional: false }],
);

check(
  "simple span 05-01 → 05-31",
  round(seasonSegments(range([{ start: "05-01", end: "05-31" }]))),
  [{ leftPct: 32.88, widthPct: 8.49, conditional: false }],
);

check(
  "wrap span 09-01 → 01-31 splits across year end",
  round(seasonSegments(range([{ start: "09-01", end: "01-31" }]))),
  [
    { leftPct: 66.58, widthPct: 33.42, conditional: false },
    { leftPct: 0, widthPct: 8.49, conditional: false },
  ],
);

check(
  "disjoint periods → concatenated segments",
  round(
    seasonSegments(
      range([
        { start: "05-01", end: "05-31" },
        { start: "09-01", end: "01-31" },
      ]),
    ),
  ),
  [
    { leftPct: 32.88, widthPct: 8.49, conditional: false },
    { leftPct: 66.58, widthPct: 33.42, conditional: false },
    { leftPct: 0, widthPct: 8.49, conditional: false },
  ],
);

check(
  "conditional flag propagates to segments",
  seasonSegments(
    range([{ start: "09-16", end: "10-31" }], { conditional: true }),
  ).every((s) => s.conditional === true),
  true,
);

check(
  "permit-only (conditional, no periods) → no segments",
  seasonSegments(range([], { conditional: true, conditionNotes: "x" })),
  [],
);

// today marker: 5 June → day-of-year 155 / 365
check(
  "today fraction (5 June)",
  r2(todayFraction(at("2026-06-05T12:00:00Z")) * 100),
  42.47,
);

if (failures) {
  console.error(`\n✗ ${failures} test(s) failed`);
  process.exit(1);
}
console.log("\n✓ all timeline tests pass");
