import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "./backup";
import type { PersistedState } from "./store";

const state: PersistedState = {
  transactionsCsv: "date,action\n2025-01-01,BUY\n",
  corporateActionsCsv: "date,type\n",
  incomeCsv: "fy_end,source_type\n2026,TRUST\n",
  method: "minimise_gain",
  brokerUnits: { DHHF: 809, NAB: 146 },
};

describe("backup / restore", () => {
  it("round-trips the persisted state", () => {
    const text = JSON.stringify(buildBackup(state));
    expect(parseBackup(text)).toEqual(state);
  });

  it("accepts a bare state object (no wrapper)", () => {
    expect(parseBackup(JSON.stringify(state))).toEqual(state);
  });

  it("defaults an unknown method to fifo and drops bad broker units", () => {
    const r = parseBackup(
      JSON.stringify({ transactionsCsv: "x", method: "bogus", brokerUnits: { A: 5, B: "nope" } }),
    );
    expect(r.method).toBe("fifo");
    expect(r.brokerUnits).toEqual({ A: 5 });
  });

  it("rejects non-backup files", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("not json")).toThrow();
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow();
  });
});
