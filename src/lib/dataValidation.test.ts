import { describe, it, expect } from "vitest";
import federalJson from "../../data/federal.json";
import taxonomyJson from "../../data/taxonomy.json";
import { TAG_KEYS } from "./tags";
import { validateData, type StateFile } from "./dataValidation";
import type { Season, SeasonsFile, Taxonomy } from "./seasons";

// --- The actual gate: the shipped data must validate clean. -------------------
const realStateModules = import.meta.glob<{ default: SeasonsFile }>(
  "../../data/states/*.json",
  { eager: true },
);
const realStates: StateFile[] = Object.entries(realStateModules).map(
  ([path, mod]) => ({ file: path.split("/").pop()!, data: mod.default }),
);
const realFederal = federalJson as unknown as SeasonsFile;
const realTaxonomy = taxonomyJson as unknown as Taxonomy;

describe("validateData: shipped data", () => {
  it("federal + taxonomy + every state file pass with zero problems", () =>
    expect(
      validateData(realTaxonomy, realFederal, realStates, TAG_KEYS),
    ).toEqual([]));
});

// --- Synthetic fixtures: prove every check actually fires. --------------------
const baseTax = (): Taxonomy =>
  ({
    species: {
      schwarzwild: { label: "Schwarzwild", tags: ["hochwild"], classes: {} },
      reh: {
        label: "Rehwild",
        tags: ["niederwild"],
        classes: { bock: { label: "Rehbock" }, kitz: { label: "Kitz" } },
      },
    },
  }) as unknown as Taxonomy;

const baseFederal = (): SeasonsFile =>
  ({
    seasons: [
      { key: "schwarzwild", type: "year-round" },
      {
        key: "reh/bock",
        type: "range",
        periods: [{ start: "05-01", end: "10-15" }],
      },
      {
        key: "reh/kitz",
        type: "range",
        periods: [{ start: "09-01", end: "01-31" }],
      },
    ],
  }) as unknown as SeasonsFile;

const withState = (seasons: unknown[], state = "XX"): StateFile => ({
  file: "xx.json",
  data: { state, seasons } as unknown as SeasonsFile,
});

const run = (
  over: {
    tax?: Taxonomy;
    fed?: SeasonsFile;
    states?: StateFile[];
    merge?: (f: Season[], s: Season[], t: Taxonomy) => Season[];
  } = {},
): string[] =>
  validateData(
    over.tax ?? baseTax(),
    over.fed ?? baseFederal(),
    over.states ?? [],
    TAG_KEYS,
    over.merge,
  );

const has = (problems: string[], re: RegExp): boolean =>
  problems.some((p) => re.test(p));

describe("validateData: clean fixtures", () => {
  it("baseline (no state deltas) has no problems", () =>
    expect(run()).toEqual([]));

  it("a clean state delta merges without problems", () =>
    expect(
      run({
        states: [
          withState([
            {
              key: "reh/bock",
              type: "range",
              periods: [{ start: "06-01", end: "10-31" }],
            },
          ]),
        ],
      }),
    ).toEqual([]));
});

describe("validateData: entry checks", () => {
  it("flags a malformed key", () =>
    expect(
      has(
        run({ states: [withState([{ key: "Reh Bock", type: "closed" }])] }),
        /malformed key/,
      ),
    ).toBe(true));

  it("flags a species missing from the taxonomy", () =>
    expect(
      has(
        run({ states: [withState([{ key: "wolf", type: "closed" }])] }),
        /species 'wolf' missing/,
      ),
    ).toBe(true));

  it("flags a class missing from the taxonomy", () =>
    expect(
      has(
        run({
          states: [
            withState([
              {
                key: "reh/altbock",
                type: "range",
                periods: [{ start: "05-01", end: "10-15" }],
              },
            ]),
          ],
        }),
        /class 'altbock' missing/,
      ),
    ).toBe(true));

  it("flags an invalid type", () =>
    expect(
      has(
        run({ states: [withState([{ key: "schwarzwild", type: "open" }])] }),
        /invalid type/,
      ),
    ).toBe(true));

  it("flags a non-conditional range with no periods", () =>
    expect(
      has(
        run({
          states: [
            withState([{ key: "reh/bock", type: "range", periods: [] }]),
          ],
        }),
        /range needs >=1 period/,
      ),
    ).toBe(true));

  it("flags a 02-29 boundary (no leap-day handling)", () =>
    expect(
      has(
        run({
          states: [
            withState([
              {
                key: "reh/bock",
                type: "range",
                periods: [{ start: "01-01", end: "02-29" }],
              },
            ]),
          ],
        }),
        /02-29/,
      ),
    ).toBe(true));

  it("flags a conditional season without conditionNotes", () =>
    expect(
      has(
        run({
          states: [
            withState([
              {
                key: "reh/bock",
                type: "range",
                conditional: true,
                periods: [],
              },
            ]),
          ],
        }),
        /conditional but no conditionNotes/,
      ),
    ).toBe(true));

  it("flags a missing 2-letter state code", () =>
    expect(
      has(
        run({ states: [withState([], "XXX")] }),
        /missing 2-letter state code/,
      ),
    ).toBe(true));
});

describe("validateData: taxonomy checks", () => {
  it("flags a tag outside the controlled vocabulary", () => {
    const tax = baseTax();
    tax.species.schwarzwild.tags = ["hochwild", "blahwild"];
    expect(has(run({ tax }), /unknown tag 'blahwild'/)).toBe(true);
  });

  it("flags a species carrying both hoch- and niederwild", () => {
    const tax = baseTax();
    tax.species.schwarzwild.tags = ["hochwild", "niederwild"];
    expect(has(run({ tax }), /exactly one of hochwild\/niederwild/)).toBe(true);
  });

  it("flags a species carrying neither hoch- nor niederwild", () => {
    const tax = baseTax();
    tax.species.reh.tags = [];
    expect(has(run({ tax }), /exactly one of hochwild\/niederwild/)).toBe(true);
  });
});

// The post-merge invariants guard against a future bug in mergeSeasons — a
// correct merge can never trip them from valid input (resolveLayer always
// expands split species, dedupes by key, and stamps provenance). To keep the
// guards themselves from silently rotting, inject a deliberately broken merge.
describe("validateData: post-merge guards", () => {
  const oneState = [withState([])];
  const merging = (out: unknown[]) => (): Season[] =>
    out as unknown as Season[];

  it("flags duplicate keys after merge", () =>
    expect(
      has(
        run({
          states: oneState,
          merge: merging([
            { key: "reh/bock", provenance: "federal" },
            { key: "reh/bock", provenance: "state" },
          ]),
        }),
        /duplicate keys after merge/,
      ),
    ).toBe(true));

  it("flags a bare split-species that survived expansion", () =>
    expect(
      has(
        run({
          states: oneState,
          merge: merging([{ key: "reh", provenance: "federal" }]),
        }),
        /bare 'reh' survived merge/,
      ),
    ).toBe(true));

  it("flags an entry missing provenance", () =>
    expect(
      has(
        run({
          states: oneState,
          merge: merging([{ key: "reh/bock" }]),
        }),
        /missing provenance/,
      ),
    ).toBe(true));
});
