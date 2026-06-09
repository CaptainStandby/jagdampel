import { computeStatus, type StatusKind } from "./status.ts";
import { matchesTags } from "./filters.ts";
import type { MatrixRow, SeasonMatrix } from "./data.ts";

/** Sentinel class value: aggregate all classes of a species. */
export const GESAMT = "gesamt";

/** One entry in the searchable species picker. */
export interface SpeciesOption {
  speciesKey: string;
  label: string;
  tags: string[];
  /** Empty for species the taxonomy does not split into classes. */
  classes: { classKey: string; label: string }[];
}

/** What drives the map: category chips (count mode) or a chosen species/class. */
export interface MapSelection {
  tags: ReadonlySet<string>;
  /** null → count mode. */
  speciesKey: string | null;
  /** A real classKey, GESAMT, or null (classless species / count mode). */
  classKey: string | null;
}

/** Per-state render instruction. */
export type StateCell =
  | { mode: "count"; count: number }
  | { mode: "single"; status: StatusKind }
  | { mode: "gesamt"; statuses: StatusKind[]; mixed: boolean }
  | { mode: "absent" };

const RANK: Record<StatusKind, number> = {
  open: 0,
  conditional: 1,
  soon: 2,
  closed: 3,
};
const HUNTABLE_NOW: ReadonlySet<StatusKind> = new Set(["open", "conditional"]);

function rowsBySpecies(matrix: SeasonMatrix): Map<string, MatrixRow[]> {
  const grouped = new Map<string, MatrixRow[]>();
  for (const row of matrix.rows) {
    const list = grouped.get(row.speciesKey) ?? [];
    list.push(row);
    grouped.set(row.speciesKey, list);
  }
  return grouped;
}

/** The species present in any state, with their classes — sorted for display. */
export function speciesOptions(matrix: SeasonMatrix): SpeciesOption[] {
  const options: SpeciesOption[] = [];
  for (const [speciesKey, rows] of rowsBySpecies(matrix)) {
    const classes = rows
      .filter((r) => r.key.includes("/"))
      .map((r) => ({
        classKey: r.key.split("/")[1],
        label: r.classLabel ?? r.key.split("/")[1],
      }));
    options.push({
      speciesKey,
      label: rows[0].speciesLabel,
      tags: rows[0].tags,
      classes,
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "de"));
}

function statusAt(row: MatrixRow, i: number, now: Date): StatusKind | null {
  const cell = row.cells[i];
  return cell ? computeStatus(cell, now).kind : null;
}

/**
 * The map's per-state instruction for a selection, computed for `now`.
 * Pure: `now` is injected so it is deterministic and node-testable.
 */
export function perStateView(
  matrix: SeasonMatrix,
  selection: MapSelection,
  now: Date,
): Map<string, StateCell> {
  const out = new Map<string, StateCell>();
  const grouped = rowsBySpecies(matrix);

  // Count mode — number of species (not class atoms) huntable today.
  if (!selection.speciesKey) {
    matrix.states.forEach((s, i) => {
      let count = 0;
      for (const rows of grouped.values()) {
        if (!matchesTags(rows[0].tags, selection.tags)) continue;
        const huntable = rows.some((r) => {
          const k = statusAt(r, i, now);
          return k !== null && HUNTABLE_NOW.has(k);
        });
        if (huntable) count += 1;
      }
      out.set(s.code, { mode: "count", count });
    });
    return out;
  }

  const rows = grouped.get(selection.speciesKey) ?? [];
  const classRows = rows.filter((r) => r.key.includes("/"));
  const wholeRow = rows.find((r) => !r.key.includes("/"));

  // Explicit single class.
  if (selection.classKey && selection.classKey !== GESAMT) {
    const row = classRows.find(
      (r) => r.key === `${selection.speciesKey}/${selection.classKey}`,
    );
    matrix.states.forEach((s, i) => {
      const k = row ? statusAt(row, i, now) : null;
      out.set(s.code, k ? { mode: "single", status: k } : { mode: "absent" });
    });
    return out;
  }

  // Classless species → its single whole row.
  if (wholeRow && classRows.length === 0) {
    matrix.states.forEach((s, i) => {
      const k = statusAt(wholeRow, i, now);
      out.set(s.code, k ? { mode: "single", status: k } : { mode: "absent" });
    });
    return out;
  }

  // Gesamt — aggregate the species' class rows per state.
  matrix.states.forEach((s, i) => {
    const kinds = classRows
      .map((r) => statusAt(r, i, now))
      .filter((k): k is StatusKind => k !== null);
    if (kinds.length === 0) {
      out.set(s.code, { mode: "absent" });
      return;
    }
    const unique = [...new Set(kinds)].sort((a, b) => RANK[a] - RANK[b]);
    out.set(s.code, {
      mode: "gesamt",
      statuses: unique,
      mixed: unique.length > 1,
    });
  });
  return out;
}
