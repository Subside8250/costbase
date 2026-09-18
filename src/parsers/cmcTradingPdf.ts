/**
 * CMC Invest "Trading Account Statement" PDF (the EOFY statements) → BUY/SELL
 * transactions. Same information as the CSV export, for when you only have the
 * PDF. Each trade row looks like:
 *   "01/07/2024 12345678 Bght 100 XYZ @ 20.0000 AUD 2,000.00 2,000.00"
 * The first amount after "AUD" is the AUD consideration (net of brokerage/GST);
 * the second is the running balance. Foreign dividends appear only as net cash
 * (item 20 needs the GROSS figure), so they're noted, not imported.
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { dmyToIso, itemId, money2, parseNum } from "./util";

const TRADE_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+\d+\s+(Bght|Sold)\s+([\d,]+)\s+([A-Za-z0-9]+)(?::([A-Za-z]+))?\s+@.*?\bAUD\s+([\d,]+\.\d{2})/;

function market(suffix: string | undefined): string {
  if (!suffix) return "ASX";
  const s = suffix.toUpperCase();
  if (s === "US") return "US";
  if (s === "HK") return "HKEX";
  return s;
}

export const cmcTradingPdfParser: DocParser = {
  id: "cmc-trading-pdf",
  label: "CMC trading account statement (PDF)",

  detect({ kind, text }) {
    return kind === "pdf" && /trading account statement/i.test(text) && /\b(Bght|Sold)\b/.test(text);
  },

  parse({ fileName, lines }): ParseResult {
    const items: ExtractedItem[] = [];
    let foreignDivs = 0;
    for (const line of lines) {
      const m = line.match(TRADE_RE);
      if (m) {
        const iso = dmyToIso(m[1]);
        const action = m[2] === "Bght" ? "BUY" : "SELL";
        const qty = m[3].replace(/,/g, "");
        const code = m[4];
        const amount = parseNum(m[6]);
        if (!iso || Number.isNaN(amount)) continue;
        items.push({
          id: itemId("cmcpdftxn"),
          target: "transactions",
          row: {
            date: iso,
            action,
            market: market(m[5]),
            code,
            quantity: qty,
            consideration_aud: money2(amount),
            currency: "AUD",
            fx_note: "",
            source: "CMC trading account statement (PDF)",
            notes: "",
          },
          summary: `${action} ${qty} ${code} — $${money2(amount)} (${iso})`,
        });
      } else if (/Intl Div/i.test(line)) {
        foreignDivs += 1;
      }
    }
    const notes: string[] = [];
    if (foreignDivs > 0) {
      notes.push(
        `${foreignDivs} international dividend payment(s) detected as net cash. Foreign income (20E) must be entered as the GROSS amount with its withholding tax (20O) from your CMC International Dividends statement — not imported here.`,
      );
    }
    if (items.length === 0 && foreignDivs === 0) {
      notes.push("No buy/sell rows were found in this statement.");
    }
    return { parser: this.id, docLabel: this.label, fileName, items, notes };
  },
};
