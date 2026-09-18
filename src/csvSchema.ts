/** Canonical CSV column orders for the three engine inputs, plus a merge
 * helper for appending reviewed rows to an existing CSV. */
import { parseCsv, stringifyCsv } from "./engine";

export const TXN_HEADERS = [
  "date", "action", "market", "code", "quantity", "consideration_aud",
  "currency", "fx_note", "source", "notes",
];

export const INCOME_HEADERS = [
  "fy_end", "source_type", "code", "pay_date", "franked", "unfranked",
  "franking_credit", "t13U", "t13C", "t13Q", "cg_discounted_grossed",
  "cg_other", "foreign_income", "foreign_tax", "nz_franking_credit",
  "amit_increase", "amit_decrease", "source", "notes",
];

export const CA_HEADERS = [
  "date", "code", "type", "ratio", "new_code", "new_quantity", "retain_pct",
  "source", "notes",
];

/** Append `rows` to an existing CSV string (or start a new one) using `headers`. */
export function appendRows(
  existingCsv: string,
  rows: Array<Record<string, string | undefined>>,
  headers: string[],
): string {
  const existing = existingCsv.trim() === "" ? [] : parseCsv(existingCsv);
  return stringifyCsv([...existing, ...rows], headers);
}
