/**
 * CMC "PortfolioReport-Equities" CSV → broker holdings for reconciliation.
 * Security codes may carry a market suffix (e.g. "ABC:US" or "1234:HK") that we
 * strip to the bare code used everywhere else.
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { itemId, parseNum } from "./util";

export const cmcPortfolioCsvParser: DocParser = {
  id: "cmc-portfolio-csv",
  label: "CMC portfolio holdings (CSV)",

  detect({ kind, csv }) {
    if (kind !== "csv" || !csv || csv.length === 0) return false;
    const cols = Object.keys(csv[0]).map((c) => c.trim().toLowerCase());
    return cols.includes("security code") && cols.includes("quantity");
  },

  parse({ fileName, csv }): ParseResult {
    const items: ExtractedItem[] = [];
    for (const r of csv ?? []) {
      const raw = (r["Security Code"] ?? "").trim();
      if (!raw) continue;
      const code = raw.split(":")[0];
      const units = parseNum(r["Quantity"]);
      if (Number.isNaN(units)) continue;
      const u = Math.round(units * 1e4) / 1e4;
      items.push({
        id: itemId("cmchold"),
        target: "brokerHoldings",
        row: { code, units: String(u) },
        summary: `${code}: ${u} units (broker)`,
      });
    }
    return {
      parser: this.id,
      docLabel: this.label,
      fileName,
      items,
      notes: ["Broker unit counts feed the holdings reconciliation only — they are not transactions."],
    };
  },
};
