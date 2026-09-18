/**
 * CMC Invest "Trading Account Statement" CSV → BUY/SELL transactions.
 *
 * The ledger's Debit (for buys) and Credit (for sells) are the AUD
 * consideration already net of brokerage/GST — exactly the engine's cost
 * base / proceeds. Cash sweeps (RG/PG), journals and interest are ignored.
 * Foreign dividends appear here only as NET cash, so they are reported as a
 * note, not imported (20E needs the GROSS figure from the CMC International
 * Dividends statement).
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { dmyToIso, itemId, money2, parseNum } from "./util";

const TRADE_RE = /^(Bght|Sold)\s+([\d,]+)\s+([A-Za-z0-9]+)(?::([A-Za-z]+))?\s+@/;

function market(suffix: string | undefined): string {
  if (!suffix) return "ASX";
  const s = suffix.toUpperCase();
  if (s === "US") return "US";
  if (s === "HK") return "HKEX";
  return s;
}

export const cmcTradingCsvParser: DocParser = {
  id: "cmc-trading-csv",
  label: "CMC trading account statement (CSV)",

  detect({ kind, csv }) {
    if (kind !== "csv" || !csv || csv.length === 0) return false;
    const cols = Object.keys(csv[0]).map((c) => c.trim().toLowerCase());
    return (
      cols.includes("description") &&
      cols.some((c) => c.startsWith("debit")) &&
      cols.some((c) => c.startsWith("balance"))
    );
  },

  parse({ fileName, csv }): ParseResult {
    const items: ExtractedItem[] = [];
    let foreignDivs = 0;
    for (const r of csv ?? []) {
      const desc = (r["Description"] ?? "").trim();
      const iso = dmyToIso(r["Date"] ?? "");
      const m = desc.match(TRADE_RE);
      if (m) {
        const action = m[1] === "Bght" ? "BUY" : "SELL";
        const qty = m[2].replace(/,/g, "");
        const code = m[3];
        const debit = parseNum(r["Debit $"] ?? r["Debit"]);
        const credit = parseNum(r["Credit $"] ?? r["Credit"]);
        const amount = action === "BUY" ? debit : credit;
        if (!iso || Number.isNaN(amount)) continue;
        items.push({
          id: itemId("cmctxn"),
          target: "transactions",
          row: {
            date: iso,
            action,
            market: market(m[4]),
            code,
            quantity: qty,
            consideration_aud: money2(amount),
            currency: "AUD",
            fx_note: "",
            source: "CMC trading account statement",
            notes: desc,
          },
          summary: `${action} ${qty} ${code} — $${money2(amount)} (${iso})`,
        });
      } else if (/Intl Div/i.test(desc)) {
        foreignDivs += 1;
      }
    }
    const notes: string[] = [];
    if (foreignDivs > 0) {
      notes.push(
        `${foreignDivs} international dividend payment(s) detected as net cash. Foreign income (20E) must be entered as the GROSS amount with its withholding tax (20O) from your CMC International Dividends statement — not imported here.`,
      );
    }
    return { parser: this.id, docLabel: this.label, fileName, items, notes };
  },
};
