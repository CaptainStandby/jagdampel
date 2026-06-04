---
name: jagdzeiten-import
description: >-
  Import or update a German federal state's hunting seasons (Jagdzeiten) into Jagdampel's layered
  data model (data/federal.json base + data/states/<code>.json deltas + data/taxonomy.json). Use
  this whenever the user provides raw regulation source — HTML/PDF/text of a Landesjagdverordnung,
  Landesjagdgesetz, or the federal BJagdZeitV — for a Bundesland, asks to add or update a state
  ("import Niedersachsen", "add Brandenburg's seasons", "update the SH data", "the Hessen rules
  changed"), or drops files into data_to_import/. Also use when extending data/taxonomy.json with new
  species or class splits. CRITICAL: the raw legal text MUST be parsed by subagents, never read into
  the main context — one regulation file is 50k–100k+ tokens and will blow the context window.
---

# Importing a Bundesland's Jagdzeiten

This skill turns raw, messy German hunting regulations into a thin, verified delta layer in
Jagdampel's data model. It has been distilled from importing Schleswig-Holstein, Bavaria, and Hessen —
three states drafted very differently, all absorbed by one schema.

**Read `references/schema.md` before starting.** It is the working reference for the data model, the
merge, and a catalogue of every legal pattern seen so far with how to encode each. This SKILL.md is
the workflow; `schema.md` is the "how do I represent X" lookup.

## The one rule that matters most

**Never read the raw regulation files yourself. Always extract via subagents.** A single
Landesjagdverordnung HTML is 50k–100k+ tokens of legal boilerplate; the structured extraction it
yields is a fraction of that. Reading even one in the main thread risks the context window; reading
three guarantees disaster. Subagents absorb the raw text and return compact, structured findings.
This is non-negotiable — it is the reason this skill exists.

## Workflow

### 1. Locate the source and identify the state
Find the raw files (the user names a path, or look in `data_to_import/`). Note the two-letter state
code (BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH). A regulation is often split
across several files/sections (e.g. § 1 species list, § 2 seasons, § 2a special provisions) — treat
each file as one unit. You may `ls`/`stat` the files for names and sizes, but do not read their
contents.

### 2. Extract via parallel subagents
Spawn **one subagent per file, all in the same turn** (parallel). Use the contract in
`references/extraction-prompt.md` verbatim, filling in the file path, state, and a one-line hint about
what the file probably is. Each subagent returns: section identity, any species list, a `seasons`
array (with `stated: open|closed`, periods, yearRound/fullyProtected/conditional flags, verbatim
notes), flagged schema-incompatibilities, ambiguities, and document metadata.

Do not proceed until you have all subagents' results. Read *their structured output*, not the files.

**If you cannot spawn subagents** (e.g. you are yourself a subagent, or the Agent tool is
unavailable): do NOT read the raw HTML directly into context. First strip it to plain text with a
throwaway script — a Landesjagdverordnung page is ~95% markup, so extracting the legal text
(paragraphs/headings) typically shrinks a 110 KB file to a few KB. Then read the distilled text. This
preserves the spirit of the cardinal rule even without subagents. Prefer real subagents when
available — they keep the raw text out of context entirely.

> Tip: pre-stripping HTML to text also makes the *subagent* extraction cheaper and more reliable, so
> it's a reasonable first step either way.

### 3. Reconcile into a thin delta (main thread — this is the judgment work)
For every extracted season, decide how it maps — consult the pattern table in `references/schema.md`:
- **Map verbatim → canonical key.** The German wording (species + class) becomes a `key` from the
  taxonomy; the verbatim wording goes into `notes`. Different states name the same class differently —
  match on the key, not the words.
- **Split combined rows.** "Dam- und Sikawild" → two species; "Schmalspießer und Schmaltiere" → two
  atoms (same dates); duck/goose/gull lists → one entry per species.
- **Classify** each as an *override* (federal has this key), an *addition* (Landesrecht species not in
  federal), or a *closure* (`type: closed`).
- **Diff against `data/federal.json` and drop matches.** This is the whole point of the layered model:
  if the state's season equals federal's, omit it — the merge inherits it. Keep only genuine
  differences. (You may read `data/federal.json`; it is small and structured.)
- Encode the tricky cases per the table: `keine Jagdzeit`→`closed`, `ganzjährig` (in a Jagdzeit
  context)→`year-round`, permit-only→`range`+`conditional:true`+empty `periods`, Maßgaben→
  `conditional`+`conditionNotes`.

### 4. Extend the taxonomy if needed
New species (e.g. neozoa like Goldschakal, Nasenbär) or a new class split (a state distinguishes
adult/juvenil where the taxonomy didn't) require adding to `data/taxonomy.json` first — `speciesKey`,
`label`, and `classes` atoms. **Adding atoms to an existing species changes whole→atom expansion for
every state**, so the verifier in step 6 must pass for all states, not just the new one.

### 5. Write `data/states/<code>.json`
A delta file: `{ state, name, source, seasons: [...] }`. Put real provenance in `source`
(regulation title + date, `asOf`). Use `source.deferred` to record anything you deliberately did NOT
model (stacked "regime" seasons, §-sections that aren't seasons) so it isn't silently lost. Keep the
entries thin (step 3).

### 6. Verify
Run the bundled checker from the repo root:
```bash
node .claude/skills/jagdzeiten-import/scripts/verify-import.mjs
```
It validates every key against the taxonomy, enforces the schema rules, runs the real
`mergeSeasons()` for every state, and asserts the post-merge invariants (no duplicate keys, no
un-expanded split-species, provenance stamped). It prints per-state effective counts. Fix until it
reports `✓ all checks pass`, then confirm the site still builds: `npm run build`.

### 7. Update the spec
Update `DESIGN_SPEC.md`: the status counts in §9 and a short provenance/decisions block in §10 for the
new state (what deviates, what was inferred, what was deferred, any version caveat).

### 8. Surface decisions for the human — do NOT guess
Wrong dates are a legal/safety problem, so this data is always an orientation aid pending human
verification. End by listing, plainly:
- **Inferences** you made (e.g. "state protects only hens, so cocks stay on the federal season").
- **Federal carryovers** the state relied on (what it left unstated).
- **Deferred** items and **ambiguities** the subagents flagged (incl. document-version uncertainty).
Ask the user to verify against the official regulation before trusting it. Never paper over a gap with
a plausible guess.

## Updating an existing state
Same workflow, but in step 3 diff against the *existing* `data/states/<code>.json` as well as federal,
and call out what changed (laws are re-issued with new Fassung dates). Update `source` with the new
regulation date. The verifier and spec update are identical.

## What "done" looks like
`verify-import.mjs` passes, `npm run build` is clean, `DESIGN_SPEC.md` reflects the new state, and the
user has a clear list of what to verify. The raw source files are gitignored (`data_to_import/`);
delete them once imported if the user agrees.
