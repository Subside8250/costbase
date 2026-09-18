/**
 * Local backup / restore. Everything CostBase persists (the three CSVs, the
 * sale method and the broker unit counts) is written to a single JSON file you
 * can keep in Dropbox and restore on another device. Fully local — no upload.
 */
import type { PersistedState } from "./store";
import type { SaleMethod } from "./engine";
import { isoDate } from "./format";

const METHODS: SaleMethod[] = ["fifo", "lifo", "minimise_gain"];

export interface BackupFile {
  app: "CostBase";
  type: "backup";
  version: number;
  exportedAt: string;
  data: PersistedState;
}

export function buildBackup(state: PersistedState): BackupFile {
  return { app: "CostBase", type: "backup", version: 1, exportedAt: new Date().toISOString(), data: state };
}

/** Trigger a download of the current state as a .json backup file. */
export function downloadBackup(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `costbase-backup-${isoDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse a backup file's text back into a PersistedState, validating shape.
 * Accepts either the wrapped { data: … } file or a bare state object. */
export function parseBackup(text: string): PersistedState {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON — is it a CostBase backup?");
  }
  const raw =
    obj && typeof obj === "object" && "data" in (obj as Record<string, unknown>)
      ? (obj as Record<string, unknown>).data
      : obj;
  if (!raw || typeof raw !== "object") throw new Error("That file isn't a CostBase backup.");
  const r = raw as Record<string, unknown>;
  if (!("transactionsCsv" in r) && !("incomeCsv" in r) && !("corporateActionsCsv" in r)) {
    throw new Error("That file doesn't look like a CostBase backup (no data found).");
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const method = METHODS.includes(r.method as SaleMethod) ? (r.method as SaleMethod) : "fifo";
  const brokerUnits: Record<string, number> = {};
  if (r.brokerUnits && typeof r.brokerUnits === "object") {
    for (const [k, v] of Object.entries(r.brokerUnits as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) brokerUnits[k] = n;
    }
  }
  return {
    transactionsCsv: str(r.transactionsCsv),
    corporateActionsCsv: str(r.corporateActionsCsv),
    incomeCsv: str(r.incomeCsv),
    method,
    brokerUnits,
  };
}
