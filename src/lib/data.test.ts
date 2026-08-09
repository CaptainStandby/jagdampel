import { describe, it, expect } from "vitest";
import {
  availableStates,
  availableSpecies,
  getStateSeasons,
  getSpeciesDetail,
  speciesMatrix,
  buildMatrix,
} from "./data";

// These exercise the real federal + state JSON merged through Vite's
// import.meta.glob — the layer plain Node couldn't import. The dataset grows as
// states are imported, so assert invariants (shape, ordering, key form), never
// golden counts.

describe("availableStates", () => {
  const states = availableStates();

  it("returns at least one published state", () =>
    expect(states.length).toBeGreaterThan(0));

  it("every code is a two-letter uppercase Bundesland code", () =>
    expect(states.every((s) => /^[A-Z]{2}$/.test(s.code))).toBe(true));

  it("is sorted by name (de locale)", () => {
    const names = states.map((s) => s.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "de"));
    expect(names).toEqual(sorted);
  });
});

describe("availableSpecies", () => {
  const species = availableSpecies();

  it("covers the whole taxonomy", () =>
    expect(species.length).toBeGreaterThan(0));

  it("every key is URL-safe", () =>
    expect(species.every((s) => /^[a-z0-9-]+$/.test(s.key))).toBe(true));

  it("is sorted by label (de locale)", () => {
    const labels = species.map((s) => s.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "de"));
    expect(labels).toEqual(sorted);
  });
});

describe("getStateSeasons", () => {
  it("returns grouped seasons for an available state", () => {
    const code = availableStates()[0].code;
    const state = getStateSeasons(code);
    expect(state).not.toBeNull();
    expect(state!.code).toBe(code);
    expect(Array.isArray(state!.groups)).toBe(true);
    expect(state!.groups.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown code", () =>
    expect(getStateSeasons("ZZ")).toBeNull());

  it("returns the same reference on repeated calls (memoization)", () => {
    const code = availableStates()[0].code;
    const first = getStateSeasons(code);
    const second = getStateSeasons(code);
    expect(first).toBe(second);
  });

  it("normalizes cache key to uppercase (lowercase input hits cache)", () => {
    const code = availableStates()[0].code;
    const upper = getStateSeasons(code);
    const lower = getStateSeasons(code.toLowerCase());
    expect(lower).toBe(upper);
  });
});

describe("getSpeciesDetail", () => {
  it("returns null for a key not in the taxonomy", () =>
    expect(getSpeciesDetail("not-a-real-species")).toBeNull());

  it("resolves a federally-present species across states", () => {
    const detail = getSpeciesDetail("schwarzwild");
    expect(detail).not.toBeNull();
    expect(detail!.speciesLabel).toBe("Schwarzwild");
    expect(Array.isArray(detail!.states)).toBe(true);
    expect(detail!.states.length).toBeGreaterThan(0);
  });

  it("per-state entries carry no source field (payload-bloat guard)", () => {
    const detail = getSpeciesDetail("schwarzwild")!;
    for (const state of detail.states) {
      expect(state).toHaveProperty("code");
      expect(state).toHaveProperty("name");
      expect(state).toHaveProperty("entries");
      expect(state).not.toHaveProperty("source");
    }
  });
});

describe("buildMatrix memoization", () => {
  it("returns the exact same reference on repeated calls", () => {
    const m1 = buildMatrix();
    const m2 = buildMatrix();
    expect(m1).toBe(m2);
  });

  it("returns a deeply frozen object to prevent mutation of the global cache", () => {
    const m = buildMatrix();
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.states)).toBe(true);
    expect(Object.isFrozen(m.rows)).toBe(true);
    if (m.rows.length > 0) {
      expect(Object.isFrozen(m.rows[0])).toBe(true);
      expect(Object.isFrozen(m.rows[0].tags)).toBe(true);
      expect(Object.isFrozen(m.rows[0].cells)).toBe(true);
      if (m.rows[0].cells.length > 0 && m.rows[0].cells[0] !== null) {
        expect(Object.isFrozen(m.rows[0].cells[0])).toBe(true);
      }
    }
  });
});

describe("speciesMatrix", () => {
  it("returns all states and only the requested species' rows", () => {
    const m = speciesMatrix("schwarzwild");
    expect(m.states).toEqual(availableStates());
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows.every((r) => r.speciesKey === "schwarzwild")).toBe(true);
  });

  it("unknown species → no rows but full state list", () => {
    const m = speciesMatrix("not-a-real-species");
    expect(m.rows).toEqual([]);
    expect(m.states.length).toBeGreaterThan(0);
  });
});
