#!/usr/bin/env node
// Unit tests for the status computation brain (src/lib/status.ts).
//
// Run from the repo root:  node scripts/test-status.mjs  (or: npm test)
//
// Node 24 strips the TS types, so we import the .ts module directly — same trick
// the import verifier uses. Exits non-zero on any failure, so it gates commits.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/status.ts")).href
);
const { computeStatus, berlinDate, DEFAULT_LOOKAHEAD_DAYS, monthStatus } = mod;

let failures = 0;
const at = (iso) => new Date(iso);

const stable = (v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? JSON.stringify(Object.fromEntries(Object.entries(v).sort()))
    : JSON.stringify(v);

function check(name, actual, expected) {
  const a = stable(actual);
  const e = stable(expected);
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

// --- Berlin date resolution (DST-aware) ---
check(
  "berlin date: winter instant rolls past midnight (CET +1)",
  berlinDate(at("2026-01-01T23:30:00Z")),
  { year: 2026, month: 1, day: 2 },
);
check(
  "berlin date: summer instant rolls past midnight (CEST +2)",
  berlinDate(at("2026-07-01T22:30:00Z")),
  { year: 2026, month: 7, day: 2 },
);

// --- type: year-round / closed ---
check(
  "year-round → open",
  computeStatus({ key: "x", type: "year-round" }, at("2026-06-15T12:00:00Z"))
    .kind,
  "open",
);
check(
  "closed → closed",
  computeStatus({ key: "x", type: "closed" }, at("2026-06-15T12:00:00Z")).kind,
  "closed",
);
check(
  "year-round + conditional → conditional",
  computeStatus(
    { key: "x", type: "year-round", conditional: true, conditionNotes: "n" },
    at("2026-06-15T12:00:00Z"),
  ).kind,
  "conditional",
);

// --- type: range, simple span ---
check(
  "range open now, reports end",
  computeStatus(
    range([{ start: "09-01", end: "01-31" }]),
    at("2026-01-15T12:00:00Z"),
  ),
  {
    kind: "open",
    conditional: false,
    conditionNotes: null,
    activeEnd: "01-31",
  },
);
check(
  "range opens soon (16 days)",
  computeStatus(
    range([{ start: "07-01", end: "08-31" }]),
    at("2026-06-15T12:00:00Z"),
  ),
  {
    kind: "soon",
    conditional: false,
    conditionNotes: null,
    daysUntilOpen: 16,
    nextStart: "07-01",
  },
);
check(
  "range closed, next opening beyond lookahead",
  computeStatus(
    range([{ start: "10-01", end: "11-30" }]),
    at("2026-06-15T12:00:00Z"),
  ),
  {
    kind: "closed",
    conditional: false,
    conditionNotes: null,
    nextStart: "10-01",
  },
);

// --- lookahead boundary (default 30) ---
check(
  "soon exactly at lookahead boundary (30 days, inclusive)",
  computeStatus(
    range([{ start: "07-01", end: "08-31" }]),
    at("2026-06-01T12:00:00Z"),
  ).kind,
  "soon",
);
check(
  "closed one day past lookahead (31 days)",
  computeStatus(
    range([{ start: "07-01", end: "08-31" }]),
    at("2026-05-31T12:00:00Z"),
  ).kind,
  "closed",
);

// --- wrap-around period ---
check(
  "wrap period open in January (07-01 → 02-28)",
  computeStatus(
    range([{ start: "07-01", end: "02-28" }]),
    at("2026-01-15T12:00:00Z"),
  ).kind,
  "open",
);
check(
  "wrap period in the spring gap → closed, reopens 07-01",
  computeStatus(
    range([{ start: "07-01", end: "02-28" }]),
    at("2026-04-15T12:00:00Z"),
  ),
  {
    kind: "closed",
    conditional: false,
    conditionNotes: null,
    nextStart: "07-01",
  },
);

// --- disjoint periods ---
check(
  "disjoint: open in the first window",
  computeStatus(
    range([
      { start: "05-01", end: "05-31" },
      { start: "09-01", end: "01-31" },
    ]),
    at("2026-05-15T12:00:00Z"),
  ).kind,
  "open",
);
check(
  "disjoint: picks the nearest next start when between windows",
  computeStatus(
    range([
      { start: "05-01", end: "05-31" },
      { start: "09-01", end: "01-31" },
    ]),
    at("2026-07-15T12:00:00Z"),
  ).nextStart,
  "09-01",
);

// --- conditional ranges ---
check(
  "permit-only (conditional, no periods) → conditional regardless of date",
  computeStatus(
    range([], { conditional: true, conditionNotes: "nur mit Ausnahme" }),
    at("2026-06-15T12:00:00Z"),
  ).kind,
  "conditional",
);
check(
  "conditional open now → conditional, not plain open",
  computeStatus(
    range([{ start: "09-16", end: "10-31" }], {
      conditional: true,
      conditionNotes: "200 m Abstand",
    }),
    at("2026-10-01T12:00:00Z"),
  ).kind,
  "conditional",
);

// --- custom lookahead ---
check(
  "custom lookahead widens the soon window",
  computeStatus(
    range([{ start: "10-01", end: "11-30" }]),
    at("2026-06-15T12:00:00Z"),
    120,
  ).kind,
  "soon",
);

check("DEFAULT_LOOKAHEAD_DAYS is 30", DEFAULT_LOOKAHEAD_DAYS, 30);

// --- monthStatus (overview matrix) ---
check(
  "month: closed → closed",
  monthStatus({ key: "x", type: "closed" }, 8),
  "closed",
);
check(
  "month: year-round → open",
  monthStatus({ key: "x", type: "year-round" }, 8),
  "open",
);
check(
  "month: wrap 09-01→01-31 open in September",
  monthStatus(range([{ start: "09-01", end: "01-31" }]), 9),
  "open",
);
check(
  "month: wrap 09-01→01-31 open in January",
  monthStatus(range([{ start: "09-01", end: "01-31" }]), 1),
  "open",
);
check(
  "month: wrap 09-01→01-31 closed in June",
  monthStatus(range([{ start: "09-01", end: "01-31" }]), 6),
  "closed",
);
check(
  "month: span fully inside May is open in May",
  monthStatus(range([{ start: "05-10", end: "05-20" }]), 5),
  "open",
);
check(
  "month: span fully inside May is closed in April",
  monthStatus(range([{ start: "05-10", end: "05-20" }]), 4),
  "closed",
);
check(
  "month: permit-only → conditional",
  monthStatus(range([], { conditional: true, conditionNotes: "x" }), 8),
  "conditional",
);
check(
  "month: conditional open in month → conditional",
  monthStatus(
    range([{ start: "09-16", end: "10-31" }], { conditional: true }),
    10,
  ),
  "conditional",
);

if (failures) {
  console.error(`\n✗ ${failures} test(s) failed`);
  process.exit(1);
}
console.log("\n✓ all status tests pass");
