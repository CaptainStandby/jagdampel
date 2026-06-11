import { describe, it, expect } from "vitest";
import { perStateView, GESAMT } from "./mapStatus";
import type { MapSelection } from "./mapStatus";
import type { MatrixRow, SeasonMatrix } from "./data";
import type { Period, Season } from "./seasons";

// --- synthetic matrix: 3 states, 3 species (one with classes) ---
const yr = (key: string): Season => ({ key, type: "year-round" }) as Season;
const closed = (key: string): Season => ({ key, type: "closed" }) as Season;
const range = (key: string, periods: Period[]): Season =>
  ({ key, type: "range", periods }) as Season;

// states order: BY, SH, HH
const states = [
  { code: "BY", name: "Bayern" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "HH", name: "Hamburg" },
];
const rows: MatrixRow[] = [
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
] as MatrixRow[];
const matrix = { states, rows } as SeasonMatrix;
const JUNE = new Date("2026-06-15T12:00:00Z");
const sel = (over: Partial<MapSelection> = {}): MapSelection => ({
  speciesKey: null,
  classKey: null,
  ...over,
});

describe("perStateView: single mode (explicit class)", () => {
  const bock = perStateView(
    matrix,
    sel({ speciesKey: "reh", classKey: "bock" }),
    JUNE,
  );

  it("bock BY open", () =>
    expect(bock.get("BY")).toEqual({ mode: "single", status: "open" }));
  it("bock SH absent", () =>
    expect(bock.get("SH")).toEqual({ mode: "absent" }));
  it("bock HH absent", () =>
    expect(bock.get("HH")).toEqual({ mode: "absent" }));

  const kitz = perStateView(
    matrix,
    sel({ speciesKey: "reh", classKey: "kitz" }),
    JUNE,
  );

  it("kitz BY closed", () =>
    expect(kitz.get("BY")).toEqual({ mode: "single", status: "closed" }));
  it("kitz HH absent", () =>
    expect(kitz.get("HH")).toEqual({ mode: "absent" }));
});

describe("perStateView: single mode (classless species)", () => {
  const ws = perStateView(
    matrix,
    sel({ speciesKey: "wildschwein", classKey: null }),
    JUNE,
  );

  it("classless wildschwein BY open", () =>
    expect(ws.get("BY")).toEqual({ mode: "single", status: "open" }));
});

describe("perStateView: gesamt mode (aggregate classes)", () => {
  const ges = perStateView(
    matrix,
    sel({ speciesKey: "reh", classKey: GESAMT }),
    JUNE,
  );

  it("reh BY mixed (bock open, kitz closed)", () =>
    expect(ges.get("BY")).toEqual({
      mode: "gesamt",
      statuses: ["open", "closed"],
      mixed: true,
    }));

  it("reh SH uniform closed", () =>
    expect(ges.get("SH")).toEqual({
      mode: "gesamt",
      statuses: ["closed"],
      mixed: false,
    }));

  it("reh HH absent (all classes null)", () =>
    expect(ges.get("HH")).toEqual({ mode: "absent" }));
});
