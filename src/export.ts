/**
 * Excel export via SheetJS. Runs entirely in the browser — no upload. Produces
 * a workbook with the per-FY tax report, holdings, reconciliation and the raw
 * CGT events.
 */
import * as XLSX from "xlsx";
import { dividendSummary, trustSummary, type FyBreakdown, type Portfolio } from "./portfolio";
import { isoDate } from "./format";
import { fyLabel } from "./engine";

const EMPTY_BD: FyBreakdown = { fy: 0, dividends: [], trusts: [], foreignDirect: [], disposals: [] };

export function exportWorkbook(p: Portfolio): void {
  XLSX.writeFile(buildWorkbook(p), `costbase-tax-report-${isoDate(new Date())}.xlsx`);
}

/** Build the workbook (pure — no file I/O) so it can be unit-tested. */
export function buildWorkbook(p: Portfolio): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const bdFor = (fy: number): FyBreakdown => p.breakdowns[fy] ?? EMPTY_BD;

  // --- ATO return entries, itemised per holding (as entered in myTax) --------

  // Item 11 — Dividends, one row per company. Income/Credit match the myTax
  // prefill summary; the 11S/11T/11U columns are what you type into the record.
  const divRows = p.report.flatMap((r) => {
    const lines = bdFor(r.fy).dividends;
    if (lines.length === 0) return [];
    const rows = lines.map((d) => {
      const s = dividendSummary(d);
      return {
        "Financial year": r.label,
        Company: d.code,
        "Income (prefill)": s.income,
        "Credit/Tax withheld (prefill)": s.credit,
        "11S Unfranked": round2n(d.unfranked),
        "11T Franked": round2n(d.franked),
        "11U Franking credit": round2n(d.franking_credit),
      };
    });
    rows.push({
      "Financial year": r.label,
      Company: "— Total —",
      "Income (prefill)": round2n(r.item_11S_unfranked_dividends + r.item_11T_franked_dividends + r.item_11U_franking_credits),
      "Credit/Tax withheld (prefill)": r.item_11U_franking_credits,
      "11S Unfranked": r.item_11S_unfranked_dividends,
      "11T Franked": r.item_11T_franked_dividends,
      "11U Franking credit": r.item_11U_franking_credits,
    });
    return rows;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(divRows), "ATO 11 Dividends");

  // Item 13 — Managed fund distributions, one row per fund (13/20 income folded
  // into the prefill Income/Credit, then the individual labels).
  const trustRows = p.report.flatMap((r) => {
    const lines = bdFor(r.fy).trusts;
    if (lines.length === 0) return [];
    const rows = lines.map((t) => {
      const s = trustSummary(t);
      return {
        "Financial year": r.label,
        "Managed fund": t.code,
        "Income (prefill)": s.income,
        "Credit/Tax withheld (prefill)": s.credit,
        "13U Trust income": round2n(t.t13U),
        "13C Franked distribution": round2n(t.t13C),
        "13Q Franking credit": round2n(t.t13Q),
        "20E Foreign income": round2n(t.foreign_income),
        "20O Foreign tax offset": round2n(t.foreign_tax),
        "20F NZ credit": round2n(t.nz_franking_credit),
      };
    });
    rows.push({
      "Financial year": r.label,
      "Managed fund": "— Total —",
      "Income (prefill)": round2n(r.item_13U_trust_income + r.item_13C_franked_distributions + r.item_20E_foreign_income + r.item_20F_nz_franking_credit),
      "Credit/Tax withheld (prefill)": round2n(r.item_13Q_trust_franking_credits + r.item_20F_nz_franking_credit),
      "13U Trust income": r.item_13U_trust_income,
      "13C Franked distribution": r.item_13C_franked_distributions,
      "13Q Franking credit": r.item_13Q_trust_franking_credits,
      "20E Foreign income": r.item_20E_foreign_income,
      "20O Foreign tax offset": r.item_20O_foreign_tax_offset,
      "20F NZ credit": r.item_20F_nz_franking_credit,
    });
    return rows;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trustRows), "ATO 13 Managed funds");

  // Item 18 — Capital gains, per source: fund-attributed gains + own disposals.
  const cgtDetail = p.report.flatMap((r) => {
    const bd = bdFor(r.fy);
    const rows = [
      ...bd.trusts
        .filter((t) => t.cg_discounted_grossed || t.cg_other)
        .map((t) => ({
          "Financial year": r.label,
          Source: t.code,
          Kind: "Managed fund (attributed)",
          "Discounted (grossed-up)": round2n(t.cg_discounted_grossed),
          "Other method": round2n(t.cg_other),
          Proceeds: "",
          "Cost base": "",
          "Gain/loss": "",
          Discount: "",
        })),
      ...bd.disposals.map((d) => ({
        "Financial year": r.label,
        Source: d.code,
        Kind: "Own disposal",
        "Discounted (grossed-up)": "",
        "Other method": "",
        Proceeds: round2n(d.proceeds),
        "Cost base": round2n(d.costBase),
        "Gain/loss": round2n(d.gain),
        Discount: d.mixedEligibility ? "part" : d.eligible ? "50%" : "no",
      })),
    ];
    return rows;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cgtDetail), "ATO 18 CGT detail");

  // Item 20 — Foreign income, one row per source.
  const foreignRows = p.report.flatMap((r) => {
    const bd = bdFor(r.fy);
    const sources = [
      ...bd.trusts
        .filter((t) => t.foreign_income || t.foreign_tax || t.nz_franking_credit)
        .map((t) => ({ name: t.code, e: t.foreign_income, o: t.foreign_tax, f: t.nz_franking_credit })),
      ...bd.foreignDirect.map((f) => ({ name: `${f.code} (direct)`, e: f.foreign_income, o: f.foreign_tax, f: 0 })),
    ];
    if (sources.length === 0) return [];
    const rows = sources.map((s) => ({
      "Financial year": r.label,
      Source: s.name,
      "20E Assessable foreign income": round2n(s.e),
      "20O Foreign tax offset": round2n(s.o),
      "20F NZ franking credit": round2n(s.f),
    }));
    rows.push({
      "Financial year": r.label,
      Source: "— Total —",
      "20E Assessable foreign income": r.item_20E_foreign_income,
      "20O Foreign tax offset": r.item_20O_foreign_tax_offset,
      "20F NZ franking credit": r.item_20F_nz_franking_credit,
    });
    return rows;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foreignRows), "ATO 20 Foreign");

  const taxRows = p.report.map((r) => ({
    "Financial year": r.label,
    "11T Franked dividends": r.item_11T_franked_dividends,
    "11S Unfranked dividends": r.item_11S_unfranked_dividends,
    "11U Franking credits": r.item_11U_franking_credits,
    "13U Trust income": r.item_13U_trust_income,
    "13C Franked distributions": r.item_13C_franked_distributions,
    "13Q Trust franking credits": r.item_13Q_trust_franking_credits,
    "18H Total capital gains": r.item_18H_total_capital_gains,
    "18A Net capital gain": r.item_18A_net_capital_gain,
    "Loss carried in": r.capital_loss_carried_in,
    "18V Loss carried forward": r.capital_loss_carried_forward,
    "20E Foreign income": r.item_20E_foreign_income,
    "20O Foreign tax offset": r.item_20O_foreign_tax_offset,
    "20F NZ franking credit": r.item_20F_nz_franking_credit,
    "AMIT cost-base increase": r.amit_cost_base_increase,
    "AMIT cost-base decrease": r.amit_cost_base_decrease,
    "CGT events": r.num_cgt_events,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taxRows), "Tax Report");

  const holdingRows = p.holdings.map((h) => ({
    Code: h.code,
    Units: h.units,
    "Cost base (AUD)": round2n(h.costBase),
    "Cost per unit (AUD)": round2n(h.perUnit),
    "AMIT net adj (tracked)": round2n(h.amitNet),
    Parcels: h.parcels.length,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holdingRows), "Holdings");

  const parcelRows = p.holdings.flatMap((h) =>
    h.parcels.map((pl) => ({
      Code: h.code,
      "Acquired": isoDate(pl.openDate),
      Units: pl.quantity,
      "Cost base (AUD)": round2n(pl.costBase),
      "Cost per unit (AUD)": round2n(pl.perUnit),
      Origin: pl.origin,
      "Discount if sold today": pl.discountIfSoldToday ? "Yes" : "No",
    })),
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parcelRows), "Parcels");

  const reconRows = p.reconciliation.map((r) => ({
    Code: r.code,
    "Engine units": r.engine_units,
    "Broker units": r.broker_units,
    "Difference (broker − engine)": r.difference,
    Status: r.status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reconRows), "Reconciliation");

  const cgtRows = p.cgtEvents.map((c) => ({
    "FY": fyLabel(c.fy),
    Code: c.code,
    Acquired: isoDate(c.openDate),
    Sold: isoDate(c.sellDate),
    Units: c.quantity,
    "Cost base (AUD)": round2n(c.costBase),
    "Proceeds (AUD)": round2n(c.proceeds),
    "Gain/loss (AUD)": round2n(c.gain),
    "Discount eligible": c.eligible ? "Yes" : "No",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cgtRows), "CGT Events");

  if (p.warnings.length) {
    const warnRows = p.warnings.map((w) => ({ Warning: w }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warnRows), "Warnings");
  }

  return wb;
}

function round2n(x: number): number {
  return Math.round(x * 100) / 100;
}
