#!/usr/bin/env node
// Unit tests for src/lib/mapStatus.ts (the map's decision rules).
// Run from repo root:  node scripts/test-mapstatus.mjs   (or: npm test)
// Node 24 strips TS types, so we import the .ts module directly.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const mod = await import(
  pathToFileURL(join(process.cwd(), "src/lib/mapStatus.ts")).href
);
const { speciesOptions, perStateView, GESAMT } = mod;

let failures = 0;
const stable = (v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? JSON.stringify(Object.fromEntries(Object.entries(v).sort()))
    : JSON.stringify(v);
function check(name, actual, expected) {
  const a = stable(actual);
  const e = stable(expected);
  if (a === e) console.log(`✓ ${name}`);
  else {
    failures++;
    console.error(`✗ ${name}\n    expected ${e}\n    actual   ${a}`);
  }
}

// --- synthetic matrix: 3 states, 3 species (one with classes) ---
const yr = (key) => ({ key, type: "year-round" });
const closed = (key) => ({ key, type: "closed" });
const range = (key, periods) => ({ key, type: "range", periods });

// states order: BY, SH, HH
const states = [
  { code: "BY", name: "Bayern" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "HH", name: "Hamburg" },
];
const rows = [
  {
    key: "wildschwein",
    speciesKey: "wildschwein",
    speciesLabel: "Wildschwein",
    classLabel: null,
    tags: ["schalenwild"],
    cells: [yr("wildschwein"), yr("wildschwein"), yr("wildschwein")],
  },
  {
    key: "feldhase",
    speciesKey: "feldhase",
    speciesLabel: "Feldhase",
    classLabel: null,
    tags: ["niederwild"],
    // open in June only in BY
    cells: [
      range("feldhase", [{ start: "06-01", end: "06-30" }]),
      closed("feldhase"),
      closed("feldhase"),
    ],
  },
  {
    key: "reh/bock",
    speciesKey: "reh",
    speciesLabel: "Rehwild",
    classLabel: "Rehbock",
    tags: ["schalenwild"],
    // open in June in BY; absent in SH and HH
    cells: [range("reh/bock", [{ start: "05-01", end: "01-31" }]), null, null],
  },
  {
    key: "reh/kitz",
    speciesKey: "reh",
    speciesLabel: "Rehwild",
    classLabel: "Kitz",
    tags: ["schalenwild"],
    // closed in June in BY and SH; absent in HH
    cells: [
      range("reh/kitz", [{ start: "09-01", end: "01-31" }]),
      closed("reh/kitz"),
      null,
    ],
  },
];
const matrix = { states, rows };
const JUNE = new Date("2026-06-15T12:00:00Z");
const sel = (over) => ({
  tags: new Set(),
  speciesKey: null,
  classKey: null,
  ...over,
});

// --- speciesOptions ---
const opts = speciesOptions(matrix);
check(
  "speciesOptions: sorted by German label",
  opts.map((o) => o.speciesKey),
  ["feldhase", "reh", "wildschwein"],
);
check(
  "speciesOptions: classless has no classes",
  opts.find((o) => o.speciesKey === "wildschwein").classes,
  [],
);
check(
  "speciesOptions: reh exposes its classes",
  opts.find((o) => o.speciesKey === "reh").classes,
  [
    { classKey: "bock", label: "Rehbock" },
    { classKey: "kitz", label: "Kitz" },
  ],
);
check(
  "speciesOptions: tags carried through",
  opts.find((o) => o.speciesKey === "feldhase").tags,
  ["niederwild"],
);

// --- count mode (no tags): species count, not class atoms ---
const cAll = perStateView(matrix, sel(), JUNE);
check("count BY (ws+feldhase+reh)", cAll.get("BY"), {
  mode: "count",
  count: 3,
});
check("count SH (ws only)", cAll.get("SH"), { mode: "count", count: 1 });
check("count HH (ws only)", cAll.get("HH"), { mode: "count", count: 1 });

// --- count mode with tag filter excludes feldhase (niederwild) ---
const cTag = perStateView(
  matrix,
  sel({ tags: new Set(["schalenwild"]) }),
  JUNE,
);
check("count BY schalenwild (ws+reh)", cTag.get("BY"), {
  mode: "count",
  count: 2,
});
check("count SH schalenwild (ws)", cTag.get("SH"), { mode: "count", count: 1 });

// --- single mode: explicit class ---
const bock = perStateView(
  matrix,
  sel({ speciesKey: "reh", classKey: "bock" }),
  JUNE,
);
check("single bock BY open", bock.get("BY"), {
  mode: "single",
  status: "open",
});
check("single bock SH absent", bock.get("SH"), { mode: "absent" });
check("single bock HH absent", bock.get("HH"), { mode: "absent" });

const kitz = perStateView(
  matrix,
  sel({ speciesKey: "reh", classKey: "kitz" }),
  JUNE,
);
check("single kitz BY closed", kitz.get("BY"), {
  mode: "single",
  status: "closed",
});
check("single kitz HH absent", kitz.get("HH"), { mode: "absent" });

// --- single mode: classless species (classKey null) ---
const ws = perStateView(
  matrix,
  sel({ speciesKey: "wildschwein", classKey: null }),
  JUNE,
);
check("single classless wildschwein BY open", ws.get("BY"), {
  mode: "single",
  status: "open",
});

// --- gesamt mode: aggregate classes ---
const ges = perStateView(
  matrix,
  sel({ speciesKey: "reh", classKey: GESAMT }),
  JUNE,
);
check("gesamt reh BY mixed (bock open, kitz closed)", ges.get("BY"), {
  mode: "gesamt",
  statuses: ["open", "closed"],
  mixed: true,
});
check("gesamt reh SH uniform closed", ges.get("SH"), {
  mode: "gesamt",
  statuses: ["closed"],
  mixed: false,
});
check("gesamt reh HH absent (all classes null)", ges.get("HH"), {
  mode: "absent",
});

if (failures) {
  console.error(`\n✗ ${failures} test(s) failed`);
  process.exit(1);
}
console.log("\n✓ all mapStatus tests pass");
