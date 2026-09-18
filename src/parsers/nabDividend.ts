/**
 * NAB (Computershare) dividend statement → a DIVIDEND income row, plus the DRP
 * share allotment as a DRP transaction. The financial year follows the PAYMENT
 * date, so a 2-July payment lands in the following FY.
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { fyEndFromIso, itemId, longDateToIso, money2, parseNum } from "./util";

// "146 $36.48 $0.00 $124.10 $53.19 3" → shares, price, unfranked, franked, credit, allotted
const VALUES_RE =
  /(\d+)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+(\d+)\b/;
// "3 ordinary share/s allotted @ $36.48 per share $109.44"
const DRP_RE = /(\d+)\s+ordinary shares?\/?s?\s+allotted @ \$([\d,]+\.\d{2}) per share\s+\$([\d,]+\.\d{2})/i;

export const nabDividendParser: DocParser = {
  id: "nab-dividend",
  label: "NAB dividend statement",

  detect({ kind, text }) {
    return (
      kind === "pdf" &&
      /national australia bank/i.test(text) &&
      /dividend statement/i.test(text)
    );
  },

  parse({ fileName, lines, text }): ParseResult {
    const codeMatch = text.match(/ASX code\s+([A-Z]+)/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : "NAB";

    // Payment date: on/near the "Payment Date" line.
    let payIso = "";
    const pdIdx = lines.findIndex((l) => /payment date/i.test(l));
    if (pdIdx !== -1) {
      for (let i = pdIdx; i < Math.min(pdIdx + 3, lines.length); i++) {
        const iso = longDateToIso(lines[i]);
        if (iso) {
          payIso = iso;
          break;
        }
      }
    }

    const values = text.match(VALUES_RE);
    const franked = values ? values[4] : "";
    const unfranked = values ? values[3] : "";
    const franking = values ? values[5] : "";

    const notes: string[] = [];
    if (!payIso) notes.push("Could not read the payment date — set it before applying (it sets the FY).");
    if (!values) notes.push("Could not read the dividend amounts — enter franked/franking figures manually.");

    const items: ExtractedItem[] = [];
    items.push({
      id: itemId("nabdiv"),
      target: "income",
      row: {
        fy_end: payIso ? String(fyEndFromIso(payIso)) : "",
        source_type: "DIVIDEND",
        code,
        pay_date: payIso,
        franked,
        unfranked,
        franking_credit: franking,
        t13U: "", t13C: "", t13Q: "",
        cg_discounted_grossed: "", cg_other: "",
        foreign_income: "", foreign_tax: "", nz_franking_credit: "",
        amit_increase: "", amit_decrease: "",
        source: `${code} dividend statement`,
        notes: "",
      },
      summary: `DIVIDEND ${code} — franked $${franked || "?"}, credit $${franking || "?"} (paid ${payIso || "?"})`,
    });

    // DRP allotment → a DRP transaction.
    const drp = text.match(DRP_RE);
    if (drp) {
      const units = parseNum(drp[1]);
      const value = parseNum(drp[3]);
      if (!Number.isNaN(units) && units > 0 && !Number.isNaN(value)) {
        items.push({
          id: itemId("nabdrp"),
          target: "transactions",
          row: {
            date: payIso,
            action: "DRP",
            market: "ASX",
            code,
            quantity: String(units),
            consideration_aud: money2(value),
            currency: "AUD",
            fx_note: "",
            source: `${code} dividend statement (DRP)`,
            notes: `${units} shares @ $${money2(parseNum(drp[2]))}`,
          },
          summary: `DRP ${units} ${code} = $${money2(value)} (${payIso || "?"})`,
        });
      }
    }

    return { parser: this.id, docLabel: `${code} dividend statement`, fileName, items, notes };
  },
};
