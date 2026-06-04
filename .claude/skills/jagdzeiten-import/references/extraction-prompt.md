# Subagent extraction prompt (template)

Spawn **one subagent per raw file** (in parallel — single message, multiple Agent calls). Each agent
reads exactly one file and returns structured findings. The main thread must **never** read the raw
files: a single Landesjagdverordnung HTML runs 50–110k tokens, and three of them will blow the
context window. The subagents absorb that cost and hand back a compact, structured result.

Fill in `{{FILE_PATH}}`, `{{STATE}}`, and `{{SECTION_HINT}}` (e.g. "the core Jagd-/Schonzeiten
section", or "a § 1 species list", or "unknown — report what it is"). Keep everything else verbatim —
this contract is tuned from real imports.

---

You are extracting official German hunting-law data from one HTML file for the state of **{{STATE}}**.
Accuracy is a legal/safety matter — DO NOT GUESS, DO NOT INVENT dates, DO NOT fill gaps from general
knowledge. If something is unclear, missing, or ambiguous, report it rather than guessing.

## Your only input file (read it fully)
`{{FILE_PATH}}`
This is part of a German hunting regulation ({{SECTION_HINT}}). It is HTML and likely unstructured —
ignore markup, navigation, and boilerplate; focus on the legal text. Read the WHOLE file.

## What to extract
Report EXACTLY what this file contains. If it is a species list, list every species verbatim, grouped
as the document groups them (e.g. Haarwild / Federwild). If it states seasons, extract every species —
and every sex/age class the law distinguishes — as its own entry.

## CRITICAL distinctions — preserve, never convert
- For each season, state whether the document gives an **open period (Jagdzeit)** or a **closed
  period (Schonzeit / "keine Jagdzeit" / ganzjährig geschont)**. Some states publish Schonzeiten
  (closed) instead of Jagdzeiten (open). Record verbatim and label it; do not convert one to the other.
- "**ganzjährig**" is ambiguous: in a Jagdzeit table it means year-round *huntable*; elsewhere it can
  mean fully protected. Report which, with the surrounding heading quoted.
- Watch for and explicitly flag: permit-only / "soweit und solange eine Ausnahme/Befreiung dies
  zulässt" (no calendar season); spatial or population Maßgaben ("zu verschonen in …", density/quota
  thresholds, distance buffers, named Schutzgebiete); multiple disjoint periods ("… und …"); age/sex
  class splits (Kalb/Schmaltier/Alttier/Hirsch, Bock/Ricke/Kitz/Schmalreh, adult/juvenil,
  Hahn/Henne); species named in combined groups ("Dam- und Sikawild", duck/goose/gull lists);
  additional/**stacked** seasons for the same species under a different legal basis (e.g. a
  damage-control window on top of a base season); anything framed as "abweichend von §…".

## Season entry shape
```jsonc
{
  "species": "verbatim German name",
  "class": "verbatim age/sex class or null",
  "stated": "open" | "closed",       // CRITICAL — open period vs closed/no-season
  "periods": [{ "start": "MM-DD", "end": "MM-DD" }],
  "yearRound": false,                // true for "ganzjährig" huntable
  "fullyProtected": false,           // true for "keine Jagdzeit" / ganzjährig geschont
  "conditional": false,              // true if open only under restrictions/permit
  "conditionNotes": "string|null",   // the restriction wording
  "notes": "VERBATIM original German wording"
}
```
Dates as `MM-DD`; a period wrapping the year has `end` < `start`; record disjoint periods as multiple
entries in `periods`. Capture each class the document lists; do not infer classes it does not mention.

## Output — return ALL of this as your final message (raw structured content, no preamble; it goes to
an orchestrator, not a human)
1. **Section identity** — which §/heading this file is, and how it relates to other sections if stated
   (e.g. "abweichend von §…", "zusätzlich zu…").
2. **Species list** (if any) — verbatim, grouped as in the document.
3. **`seasons` JSON array** (if any) in the shape above — exhaustive.
4. **Schema-relevant patterns / incompatibilities** — anything that would not fit a simple
   {species, class, open/closed, periods} model (stacked regimes, permit-only, spatial conditions,
   Schonzeit-only framing, combined-species groups, granularity differences), each with a verbatim
   quote.
5. **Ambiguities / open questions** — anything unclear or requiring a human decision, with quoted
   source text.
6. **Document metadata** — official title, date/Fassung, in-force / last-amended dates, Fundstelle,
   legal basis. State plainly if any of these is absent from the file.

Be exhaustive and literal. Quote the original German wherever you flag something.
