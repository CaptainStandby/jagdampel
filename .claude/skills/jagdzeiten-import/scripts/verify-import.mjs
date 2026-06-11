#!/usr/bin/env node
// Verify the Jagdzeiten data model end to end.
//
// Run from the repo root:  node .claude/skills/jagdzeiten-import/scripts/verify-import.mjs
//
// The validation rules live in src/lib/dataValidation.ts — the single source of
// truth, also exercised by the Vitest suite in CI. This script loads the data,
// runs that validator, and additionally prints a per-state effective-season
// summary. Exits non-zero on any problem, so it doubles as a manual/import-time
// gate. (Node strips the TS types when importing the .ts modules directly.)

import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.cwd();
const p = (...x) => join(root, ...x);
const readJson = (rel) => JSON.parse(readFileSync(p(rel), 'utf8'));

const { mergeSeasons } = await import(pathToFileURL(p('src/lib/seasons.ts')).href);
const { validateData } = await import(pathToFileURL(p('src/lib/dataValidation.ts')).href);
const { TAGS } = await import(pathToFileURL(p('src/lib/tags.ts')).href);
const allowedTags = new Set(TAGS.map((t) => t.key));

const taxonomy = readJson('data/taxonomy.json');
const federal = readJson('data/federal.json');
const stateDir = 'data/states';
const states = readdirSync(p(stateDir))
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, data: readJson(`${stateDir}/${file}`) }));

const problems = validateData(taxonomy, federal, states, allowedTags);

// Per-state effective-season summary (independent of validation, for the human).
const rows = states.map(({ data }) => {
  const eff = mergeSeasons(federal.seasons, data.seasons, taxonomy);
  const t = {}, pr = {};
  for (const s of eff) { t[s.type] = (t[s.type] || 0) + 1; pr[s.provenance] = (pr[s.provenance] || 0) + 1; }
  return { code: data.state, deltas: data.seasons.length, effective: eff.length, t, pr };
});

console.log(`taxonomy species: ${Object.keys(taxonomy.species).length} | federal entries: ${federal.seasons.length}`);
for (const r of rows.sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
  console.log(
    `${r.code}: ${r.deltas} deltas -> ${r.effective} effective ` +
    `(range ${r.t.range || 0} / year-round ${r['t']['year-round'] || 0} / closed ${r.t.closed || 0}; ` +
    `federal ${r.pr.federal || 0} / state ${r.pr.state || 0})`,
  );
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log('\n✓ all checks pass');
