/**
 * Local persistence via IndexedDB (idb). ALL data stays on the machine — no
 * network calls, ever. We persist the raw CSV text plus settings so a reload
 * restores exactly what was imported.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SaleMethod } from "./engine";

export interface PersistedState {
  transactionsCsv: string;
  corporateActionsCsv: string;
  incomeCsv: string;
  method: SaleMethod;
  brokerUnits: Record<string, number>;
}

interface CostBaseDB extends DBSchema {
  app: { key: string; value: PersistedState };
}

const DB_NAME = "costbase";
const STORE = "app";
const KEY = "state";

let dbp: Promise<IDBPDatabase<CostBaseDB>> | null = null;

function db(): Promise<IDBPDatabase<CostBaseDB>> {
  if (!dbp) {
    dbp = openDB<CostBaseDB>(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export async function loadState(): Promise<PersistedState | undefined> {
  try {
    return await (await db()).get(STORE, KEY);
  } catch {
    return undefined;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await (await db()).put(STORE, state, KEY);
  } catch {
    // Persistence is best-effort (private windows, blocked storage). The app
    // still works in-memory for the session.
  }
}

export async function clearState(): Promise<void> {
  try {
    await (await db()).delete(STORE, KEY);
  } catch {
    // ignore
  }
}
