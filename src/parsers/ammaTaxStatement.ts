/**
 * Attribution Managed Investment Trust (AMIT) member annual TAX statement →
 * one TRUST income row. Handles both the Betashares (MUFG) and Vanguard
 * (Computershare) layouts by matching each figure to its Part A item
 * DESCRIPTION (stable) rather than the tax-label column (positionally offset
 * in the PDF text).
 *
 * The capital-gains split is DERIVED from the two unambiguous Part A totals,
 * which is issuer-independent and exact:
 *   cg_discounted_grossed = 2 × (totalCurrentYearGains − netCapitalGain)
 *   cg_other              = totalCurrentYearGains − cg_discounted_grossed
 */
import type { DocParser, ExtractedItem, ParseResult } from "./types";
import { amountForLabel, itemId, money2 } from "./util";

function slicePartA(lines: string[]): string[] {
  const a = lines.findIndex((l) => /part\s*a\b/i.test(l));
  const b = lines.findIndex((l) => /part\s*b\b/i.test(l));
  if (a === -1) return lines;
  return lines.slice(a, b === -1 ? undefined : b);
}

function amt(v: number): string {
  return Number.isNaN(v) ? "" : money2(v);
}

export const ammaTaxParser: DocParser = {
  id: "amma-tax-statement",
  label: "AMIT annual tax statement",

  detect({ kind, text }) {
    if (kind !== "pdf") return false;
    return (
      /attribution managed investment trust/i.test(text) &&
      /(tax statement|tax return|for (the )?year ended)/i.test(text)
    );
  },

  parse({ fileName, lines, text }): ParseResult {
    const codeMatch = text.match(/ASX Code:\s*([A-Z0-9]+)/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : fileName.replace(/\.[^.]+$/, "");
    const fyMatch = text.match(/year ended\s+30 june\s+(\d{4})/i);
    const fyEnd = fyMatch ? fyMatch[1] : "";

    const partA = slicePartA(lines);
    const t13U = amountForLabel(partA, /net income from trusts/i);
    const t13C = amountForLabel(partA, /franked distributions? from trusts/i);
    const t13Q = amountForLabel(partA, /franking credits from franked dividends/i);
    const foreignIncome = amountForLabel(partA, /assessable foreign source income/i);
    const foreignTax = amountForLabel(partA, /foreign income tax offset/i);
    const nz = amountForLabel(partA, /new zealand franking company/i);
    const netCg = amountForLabel(partA, /^net capital gain\b/i);
    const totalCg = amountForLabel(partA, /^total current year capital gains/i);

    // Derive the discounted/other split from the two Part A totals.
    let discGrossed = NaN;
    let other = NaN;
    if (!Number.isNaN(netCg) && !Number.isNaN(totalCg)) {
      discGrossed = 2 * (totalCg - netCg);
      other = totalCg - discGrossed;
      // Clean tiny floating dust.
      discGrossed = Math.round(discGrossed * 100) / 100;
      other = Math.round(other * 100) / 100;
    }

    // AMIT cost-base adjustments (best-effort; anywhere in the document).
    // Betashares writes "(decrease cost base)"; Vanguard writes "(reduce cost base)".
    const amitIncrease = amountForLabel(lines, /shortfall \(increase cost base\)/i);
    const amitDecrease = amountForLabel(lines, /excess \((?:decrease|reduce) cost base\)/i);

    const row: Record<string, string> = {
      fy_end: fyEnd,
      source_type: "TRUST",
      code,
      pay_date: "",
      franked: "",
      unfranked: "",
      franking_credit: "",
      t13U: amt(t13U),
      t13C: amt(t13C),
      t13Q: amt(t13Q),
      cg_discounted_grossed: amt(discGrossed),
      cg_other: amt(other),
      foreign_income: amt(foreignIncome),
      foreign_tax: amt(foreignTax),
      nz_franking_credit: amt(nz),
      amit_increase: amt(amitIncrease),
      amit_decrease: amt(amitDecrease),
      source: `${code} AMMA FY${fyEnd}`,
      notes: "",
    };

    const notes: string[] = [];
    if (!fyEnd) notes.push("Could not read the financial year — set it before applying.");
    if (Number.isNaN(netCg) || Number.isNaN(totalCg)) {
      notes.push("Could not read the capital-gains totals — enter discounted/other gains manually.");
    }

    const item: ExtractedItem = {
      id: itemId("amma"),
      target: "income",
      row,
      summary: `TRUST ${code} FY${fyEnd || "?"} — 13C $${row.t13C || "0.00"}, CGT $${
        row.cg_discounted_grossed || "0.00"
      } disc, 20E $${row.foreign_income || "0.00"}`,
      flag:
        !Number.isNaN(amitIncrease) && amitIncrease !== 0
          ? "Verify AMIT cost-base increase against Part B"
          : !Number.isNaN(amitDecrease) && amitDecrease !== 0
            ? "Verify AMIT cost-base decrease against Part B"
            : undefined,
    };

    return { parser: this.id, docLabel: `${code} AMIT tax statement`, fileName, items: [item], notes };
  },
};
