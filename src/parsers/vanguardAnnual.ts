/**
 * Vanguard ETF ANNUAL statement (not the tax statement) → DRP transactions.
 *
 * The value here is the DRP allotment UNIT PRICE, which the golden master lists
 * as "unknown" for pre-FY2025 parcels. Each "Distribution Reinvested" row with
 * a unit count and unit price becomes a DRP parcel (consideration = units ×
 * price). Cash-only rows (no units) are skipped.
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { dmyToIso, itemId, money2, parseNum } from "./util";

const DRP_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+Distribution Reinvested\s+(\d+)\s+\$([\d,]+\.\d{2})/i;

export const vanguardAnnualParser: DocParser = {
  id: "vanguard-annual",
  label: "Vanguard ETF annual statement (DRP)",

  detect({ kind, text }) {
    return (
      kind === "pdf" &&
      /vanguard etf annual statement/i.test(text) &&
      /distribution reinvested/i.test(text)
    );
  },

  parse({ fileName, lines, text }): ParseResult {
    const codeMatch = text.match(/ASX Code:\s*([A-Z0-9]+)/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : "";
    const items: ExtractedItem[] = [];
    for (const line of lines) {
      const m = line.match(DRP_RE);
      if (!m) continue;
      const iso = dmyToIso(m[1]);
      const units = parseNum(m[2]);
      const price = parseNum(m[3]);
      if (!iso || Number.isNaN(units) || units <= 0 || Number.isNaN(price)) continue;
      const consideration = money2(units * price);
      items.push({
        id: itemId("vgdrp"),
        target: "transactions",
        row: {
          date: iso,
          action: "DRP",
          market: "ASX",
          code,
          quantity: String(units),
          consideration_aud: consideration,
          currency: "AUD",
          fx_note: "",
          source: `Vanguard annual statement`,
          notes: `${units} units @ $${money2(price)}`,
        },
        summary: `DRP ${units} ${code} @ $${money2(price)} = $${consideration} (${iso})`,
      });
    }
    const notes: string[] = [];
    if (!code) notes.push("Could not read the ASX code — set it before applying.");
    if (items.length === 0) notes.push("No reinvested-distribution rows with a unit price were found.");
    return { parser: this.id, docLabel: `${code || "Vanguard"} annual statement`, fileName, items, notes };
  },
};
