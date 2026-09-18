/**
 * Classify a CSV by its header row so one upload area can accept all three
 * file types. Matches on signature columns unique to each schema.
 */
export type CsvKind = "transactions" | "corporateActions" | "income";

export function detectCsvType(text: string): CsvKind | null {
  const headers = headerColumns(text);
  if (headers.size === 0) return null;
  const has = (c: string) => headers.has(c);

  // income.csv: fy_end,source_type,code,pay_date,franked,…
  if (has("source_type") && has("fy_end")) return "income";
  // transactions.csv: date,action,market,code,quantity,consideration_aud,…
  if (has("action") && has("consideration_aud")) return "transactions";
  // corporate_actions.csv: date,code,type,ratio,new_code,new_quantity,retain_pct,…
  if (has("type") && (has("retain_pct") || has("new_code") || has("ratio"))) {
    return "corporateActions";
  }
  return null;
}

function headerColumns(text: string): Set<string> {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); // strip BOM
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  return new Set(
    firstLine
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h !== ""),
  );
}

export const KIND_LABEL: Record<CsvKind, string> = {
  transactions: "Transactions",
  corporateActions: "Corporate actions",
  income: "Income",
};
