#!/usr/bin/env node
// Verify the Jagdzeiten data model end to end.
//
// Run from the repo root:  node .claude/skills/jagdzeiten-import/scripts/verify-import.mjs
//
// It loads data/taxonomy.json, data/federal.json and every data/states/*.json,
// then for each state runs the real mergeSeasons() from src/lib/seasons.ts
// (Node strips the TS types) and checks the invariants that have actually
// bitten us during the SH/BY/HE imports. Exits non-zero if anything fails, so
// it doubles as a pre-commit gate.

import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.cwd();
const p = (...x) => join(root, ...x);
const readJson = (rel) => JSON.parse(readFileSync(p(rel), 'utf8'));

const { mergeSeasons } = await import(pathToFileURL(p('src/lib/seasons.ts')).href);

const taxonomy = readJson('data/taxonomy.json');
const federal = readJson('data/federal.json');
const stateDir = 'data/states';
const stateFiles = readdirSync(p(stateDir)).filter((f) => f.endsWith('.json'));

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const reKey = /^[a-z0-9]+(\/[a-z0-9-]+)?$/;
const reDate = /^\d{2}-\d{2}$/;
const TYPES = new Set(['range', 'year-round', 'closed']);

// Species the taxonomy splits into class atoms — a bare key for one of these
// must never survive the merge; it has to expand. Derived from the taxonomy so
// it stays correct as the registry grows.
const splitSpecies = Object.entries(taxonomy.species)
  .filter(([, s]) => Object.keys(s.classes ?? {}).length > 0)
  .map(([k]) => k);

function validateEntry(scope, s) {
  if (!reKey.test(s.key)) { fails.push(`${scope}: malformed key '${s.key}'`); return; }
  const [sk, ck] = s.key.split('/');
  ok(taxonomy.species[sk], `${scope}: '${s.key}' species '${sk}' missing from taxonomy`);
  if (ck) ok(taxonomy.species[sk]?.classes?.[ck], `${scope}: '${s.key}' class '${ck}' missing from taxonomy`);
  ok(TYPES.has(s.type), `${scope}: '${s.key}' invalid type '${s.type}'`);
  // A plain open season needs at least one period; permit-only (conditional) and
  // year-round/closed legitimately carry none.
  if (s.type === 'range' && !s.conditional) {
    ok(Array.isArray(s.periods) && s.periods.length >= 1, `${scope}: '${s.key}' range needs >=1 period`);
  }
  for (const period of s.periods ?? []) {
    ok(reDate.test(period.start) && reDate.test(period.end), `${scope}: '${s.key}' bad period ${JSON.stringify(period)}`);
    // No leap-day handling: the law's 28.02. is stored verbatim, and a 02-29
    // boundary would silently roll to 01.03. in the status math.
    ok(period.start !== '02-29' && period.end !== '02-29', `${scope}: '${s.key}' uses 02-29 — store 02-28 (no leap-day handling)`);
  }
  if (s.conditional) ok(s.conditionNotes, `${scope}: '${s.key}' conditional but no conditionNotes`);
}

// Validate the base layer and every delta against the taxonomy + schema rules.
for (const s of federal.seasons) validateEntry('federal', s);
for (const f of stateFiles) {
  const file = readJson(`${stateDir}/${f}`);
  ok(typeof file.state === 'string' && file.state.length === 2, `${f}: missing 2-letter state code`);
  for (const s of file.seasons) validateEntry(f, s);
}

// Merge each state and check the post-merge invariants.
const rows = [];
for (const f of stateFiles) {
  const file = readJson(`${stateDir}/${f}`);
  const eff = mergeSeasons(federal.seasons, file.seasons, taxonomy);
  const code = file.state;

  ok(eff.length === new Set(eff.map((s) => s.key)).size, `${code}: duplicate keys after merge`);
  for (const sp of splitSpecies) {
    ok(!eff.find((s) => s.key === sp), `${code}: bare '${sp}' survived merge — whole→atom expansion failed`);
  }
  for (const s of eff) {
    ok(s.provenance === 'state' || s.provenance === 'federal', `${code}: '${s.key}' missing provenance`);
  }

  const t = {}, pr = {};
  for (const s of eff) { t[s.type] = (t[s.type] || 0) + 1; pr[s.provenance] = (pr[s.provenance] || 0) + 1; }
  rows.push({ code, deltas: file.seasons.length, effective: eff.length, t, pr });
}

console.log(`taxonomy species: ${Object.keys(taxonomy.species).length} | federal entries: ${federal.seasons.length}`);
for (const r of rows.sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(
    `${r.code}: ${r.deltas} deltas -> ${r.effective} effective ` +
    `(range ${r.t.range || 0} / year-round ${r['t']['year-round'] || 0} / closed ${r.t.closed || 0}; ` +
    `federal ${r.pr.federal || 0} / state ${r.pr.state || 0})`,
  );
}

if (fails.length) {
  console.error(`\n✗ ${fails.length} problem(s):\n- ` + fails.join('\n- '));
  process.exit(1);
}
console.log('\n✓ all checks pass');
