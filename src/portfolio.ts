/**
 * Glue between the pure engine and the React UI: parse the three CSVs, run the
 * engine, and shape the derived views (holdings with parcels, reconciliation,
 * per-code AMIT adjustments, warnings). No DOM here — just data.
 */
import {
  Engine,
  parseCsv,
  discountEligible,
  perUnit,
  D,
  fyEnd,
  round2,
  type CGTEvent,
  type CorporateActionRow,
  type FinancialYearReport,
  type IncomeRow,
  type Parcel,
  type ReconciliationRow,
  type SaleMethod,
  type TxnRow,
} from "./engine";

export interface HoldingView {
  code: string;
  units: number;
  costBase: number;
  perUnit: number;
  parcels: ParcelView[];
  /** Net AMIT cost-base adjustment reported for this code (increase − decrease).
   * Tracked for future CGT; not applied to the cost base above. */
  amitNet: number;
}

export interface ParcelView {
  openDate: Date;
  quantity: number;
  costBase: number;
  perUnit: number;
  origin: Parcel["origin"];
  discountIfSoldToday: boolean;
}

/** Per-holding contributions to a financial year's return, mirroring how each
 * dividend payer / managed fund / disposal is entered separately in myTax. */
export interface DividendLine {
  code: string;
  unfranked: number;
  franked: number;
  franking_credit: number;
}
export interface TrustLine {
  code: string;
  t13U: number;
  t13C: number;
  t13Q: number;
  cg_discounted_grossed: number;
  cg_other: number;
  foreign_income: number;
  foreign_tax: number;
  nz_franking_credit: number;
  amit_increase: number;
  amit_decrease: number;
}
export interface ForeignLine {
  code: string;
  foreign_income: number;
  foreign_tax: number;
}
export interface DisposalLine {
  code: string;
  proceeds: number;
  costBase: number;
  gain: number;
  eligible: boolean; // all contributing parcels discount-eligible
  mixedEligibility: boolean;
}
export interface FyBreakdown {
  fy: number;
  dividends: DividendLine[];
  trusts: TrustLine[];
  foreignDirect: ForeignLine[];
  disposals: DisposalLine[];
}

export interface Portfolio {
  method: SaleMethod;
  transactions: TxnRow[];
  corporateActions: CorporateActionRow[];
  income: IncomeRow[];
  report: FinancialYearReport[];
  holdings: HoldingView[];
  cgtEvents: CGTEvent[];
  reconciliation: ReconciliationRow[];
  breakdowns: Record<number, FyBreakdown>;
  warnings: string[];
  parseError: string | null;
}

export interface RawInputs {
  transactionsCsv: string;
  corporateActionsCsv: string;
  incomeCsv: string;
  brokerUnits: Record<string, number>;
  method: SaleMethod;
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const t = s.trim();
  return t === "" ? 0 : Number(t);
};

export function buildPortfolio(raw: RawInputs, today: Date = new Date()): Portfolio {
  const empty: Portfolio = {
    method: raw.method,
    transactions: [],
    corporateActions: [],
    income: [],
    report: [],
    holdings: [],
    cgtEvents: [],
    reconciliation: [],
    breakdowns: {},
    warnings: [],
    parseError: null,
  };
  let transactions: TxnRow[];
  let corporateActions: CorporateActionRow[];
  let income: IncomeRow[];
  try {
    transactions = parseCsv<TxnRow>(raw.transactionsCsv);
    corporateActions = parseCsv<CorporateActionRow>(raw.corporateActionsCsv);
    income = parseCsv<IncomeRow>(raw.incomeCsv);
  } catch (err) {
    return { ...empty, parseError: err instanceof Error ? err.message : String(err) };
  }

  const engine = new Engine(raw.method);
  engine.load(transactions, corporateActions, income);
  const report = engine.report();
  const reconciliation = engine.reconcile(raw.brokerUnits);

  // Net AMIT adjustment per code (sum across all income rows).
  const amitByCode = new Map<string, number>();
  for (const i of income) {
    if (i.source_type !== "TRUST") continue;
    const net = num(i.amit_increase) - num(i.amit_decrease);
    amitByCode.set(i.code.trim(), (amitByCode.get(i.code.trim()) ?? 0) + net);
  }

  const holdings: HoldingView[] = [];
  for (const [code, parcels] of engine.parcels) {
    const units = parcels.reduce((s, p) => s + p.quantity, 0);
    if (units <= 1e-9) continue;
    const costBase = parcels.reduce((s, p) => s + p.costBase, 0);
    holdings.push({
      code,
      units: round4(units),
      costBase,
      perUnit: units ? costBase / units : 0,
      amitNet: amitByCode.get(code) ?? 0,
      parcels: parcels.map((p) => ({
        openDate: p.openDate,
        quantity: p.quantity,
        costBase: p.costBase,
        perUnit: perUnit(p),
        origin: p.origin,
        discountIfSoldToday: discountEligible(p.openDate, today),
      })),
    });
  }
  holdings.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  const breakdowns = buildBreakdowns(income, engine.cgt);

  return {
    method: raw.method,
    transactions,
    corporateActions,
    income,
    report,
    holdings,
    cgtEvents: engine.cgt,
    reconciliation,
    breakdowns,
    warnings: engine.warnings,
    parseError: null,
  };
}

/** Financial year an income row belongs to — DIVIDEND uses the payment date,
 * TRUST/FOREIGN use the fy_end column (matches the engine). */
function incomeFy(i: IncomeRow): number {
  if (i.pay_date && i.pay_date.trim() !== "") return fyEnd(D(i.pay_date));
  return Number(i.fy_end);
}

function buildBreakdowns(income: IncomeRow[], cgt: CGTEvent[]): Record<number, FyBreakdown> {
  const out: Record<number, FyBreakdown> = {};
  const fy = (n: number): FyBreakdown =>
    (out[n] ??= { fy: n, dividends: [], trusts: [], foreignDirect: [], disposals: [] });

  const upsert = <T extends { code: string }>(arr: T[], code: string, make: () => T): T => {
    let line = arr.find((x) => x.code === code);
    if (!line) {
      line = make();
      arr.push(line);
    }
    return line;
  };

  for (const i of income) {
    const b = fy(incomeFy(i));
    const code = i.code.trim();
    if (i.source_type === "DIVIDEND") {
      const line = upsert(b.dividends, code, () => ({ code, unfranked: 0, franked: 0, franking_credit: 0 }));
      line.unfranked = round2(line.unfranked + num(i.unfranked));
      line.franked = round2(line.franked + num(i.franked));
      line.franking_credit = round2(line.franking_credit + num(i.franking_credit));
    } else if (i.source_type === "TRUST") {
      const line = upsert(b.trusts, code, () => ({
        code, t13U: 0, t13C: 0, t13Q: 0, cg_discounted_grossed: 0, cg_other: 0,
        foreign_income: 0, foreign_tax: 0, nz_franking_credit: 0, amit_increase: 0, amit_decrease: 0,
      }));
      line.t13U = round2(line.t13U + num(i.t13U));
      line.t13C = round2(line.t13C + num(i.t13C));
      line.t13Q = round2(line.t13Q + num(i.t13Q));
      line.cg_discounted_grossed = round2(line.cg_discounted_grossed + num(i.cg_discounted_grossed));
      line.cg_other = round2(line.cg_other + num(i.cg_other));
      line.foreign_income = round2(line.foreign_income + num(i.foreign_income));
      line.foreign_tax = round2(line.foreign_tax + num(i.foreign_tax));
      line.nz_franking_credit = round2(line.nz_franking_credit + num(i.nz_franking_credit));
      line.amit_increase = round2(line.amit_increase + num(i.amit_increase));
      line.amit_decrease = round2(line.amit_decrease + num(i.amit_decrease));
    } else if (i.source_type === "FOREIGN") {
      const line = upsert(b.foreignDirect, code, () => ({ code, foreign_income: 0, foreign_tax: 0 }));
      line.foreign_income = round2(line.foreign_income + num(i.foreign_income));
      line.foreign_tax = round2(line.foreign_tax + num(i.foreign_tax));
    }
  }

  for (const e of cgt) {
    const b = fy(e.fy);
    let line = b.disposals.find((d) => d.code === e.code);
    if (!line) {
      line = { code: e.code, proceeds: 0, costBase: 0, gain: 0, eligible: e.eligible, mixedEligibility: false };
      b.disposals.push(line);
    } else if (line.eligible !== e.eligible) {
      line.mixedEligibility = true;
    }
    line.proceeds = round2(line.proceeds + e.proceeds);
    line.costBase = round2(line.costBase + e.costBase);
    line.gain = round2(line.gain + e.gain);
  }

  return out;
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** The Income / Credit pair myTax shows for a dividend payer on its summary
 * screen: Income is the grossed-up dividend (cash + franking credit), Credit is
 * the franking credit. */
export function dividendSummary(d: DividendLine): { income: number; credit: number } {
  return {
    income: round2(d.unfranked + d.franked + d.franking_credit),
    credit: round2(d.franking_credit),
  };
}

/** The Income / Credit pair myTax shows for a managed fund distribution:
 * Income = 13U + 13C + assessable foreign income (20E) + NZ credit (20F);
 * Credit = franking credit (13Q) + NZ credit (20F). Capital gains and the
 * foreign income tax offset (20O) are handled in their own myTax sections. */
export function trustSummary(t: TrustLine): { income: number; credit: number } {
  return {
    income: round2(t.t13U + t.t13C + t.foreign_income + t.nz_franking_credit),
    credit: round2(t.t13Q + t.nz_franking_credit),
  };
}

/** A managed fund's capital-gain components as entered in its myTax record. */
export function trustCapitalGain(t: TrustLine): { total: number; net: number } {
  return {
    total: round2(t.cg_discounted_grossed + t.cg_other),
    net: round2(t.cg_discounted_grossed / 2 + t.cg_other),
  };
}
