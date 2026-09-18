/**
 * Australian share portfolio tax engine — pure, dependency-free TypeScript.
 *
 * Ported faithfully from reference/engine.py. It must reproduce every figure in
 * fixtures/expected_results.json exactly (to the cent). Calculation aid, not
 * tax advice.
 */
import { CGT_DISCOUNT, computeCgtNetting } from "./cgt";
import { D, discountEligible, fyEnd, fyLabel } from "./dates";
import { round2 } from "./round";
import type {
  CGTEvent,
  CorporateActionRow,
  FinancialYearReport,
  IncomeRow,
  Parcel,
  ReconciliationRow,
  ReconStatus,
  SaleMethod,
  TxnRow,
} from "./types";

/** Parse a possibly-empty numeric CSV cell as a float; blank → 0. */
function num(s: string | undefined | null): number {
  if (s == null) return 0;
  const t = s.trim();
  return t === "" ? 0 : Number(t);
}

const EPS = 1e-6;
const EPS_QTY = 1e-9;

export class Engine {
  readonly method: SaleMethod;
  /** Open parcels by code, in acquisition (insertion) order. */
  readonly parcels = new Map<string, Parcel[]>();
  readonly cgt: CGTEvent[] = [];
  readonly income: IncomeRow[] = [];
  readonly warnings: string[] = [];

  constructor(method: SaleMethod = "fifo") {
    this.method = method;
  }

  private list(code: string): Parcel[] {
    let ps = this.parcels.get(code);
    if (!ps) {
      ps = [];
      this.parcels.set(code, ps);
    }
    return ps;
  }

  /** Ingest the three parsed CSV row sets. Corporate actions apply AFTER
   * same-day trades; ties within a (date, kind) keep original CSV order. */
  load(txns: TxnRow[], cas: CorporateActionRow[], income: IncomeRow[]): void {
    type Item =
      | { kind: 0; date: Date; idx: number; txn: TxnRow }
      | { kind: 1; date: Date; idx: number; ca: CorporateActionRow };
    const items: Item[] = [];
    let idx = 0;
    for (const r of txns) items.push({ kind: 0, date: D(r.date), idx: idx++, txn: r });
    for (const r of cas) items.push({ kind: 1, date: D(r.date), idx: idx++, ca: r });
    items.sort((a, b) => {
      const t = a.date.getTime() - b.date.getTime();
      if (t !== 0) return t;
      if (a.kind !== b.kind) return a.kind - b.kind; // TXN (0) before CA (1)
      return a.idx - b.idx; // stable: preserve CSV order
    });
    for (const it of items) {
      if (it.kind === 0) this.txn(it.date, it.txn);
      else this.corporateAction(it.date, it.ca);
    }
    for (const r of income) this.income.push(r);
  }

  private txn(d: Date, r: TxnRow): void {
    const code = r.code.trim();
    const act = r.action.trim().toUpperCase();
    const qty = Number(r.quantity);
    const amt = Number(r.consideration_aud);
    if (act === "BUY" || act === "DRP") {
      this.list(code).push({
        code,
        openDate: d,
        quantity: qty,
        costBase: amt,
        origin: act === "DRP" ? "DRP" : "BUY",
      });
    } else if (act === "SELL") {
      this.sell(d, code, qty, amt);
    } else {
      this.warnings.push(`${iso(d)} ${code}: unknown action ${act}`);
    }
  }

  private sell(d: Date, code: string, qty: number, proceeds: number): void {
    const ps = this.list(code);
    const avail = ps.reduce((s, p) => s + p.quantity, 0);
    if (qty - avail > EPS) {
      this.warnings.push(
        `${iso(d)} ${code}: sell ${g(qty)} exceeds holding ${g(avail)} — check for a ` +
          `missing corporate action or DRP allotment`,
      );
    }
    const ppu = proceeds / qty;
    const order = this.order(ps, ppu, d);
    let left = Math.min(qty, avail);
    for (const p of order) {
      if (left <= EPS_QTY) break;
      const take = Math.min(p.quantity, left);
      const frac = take / p.quantity;
      const cb = p.costBase * frac;
      const proceedsPart = ppu * take;
      this.cgt.push({
        code,
        openDate: p.openDate,
        sellDate: d,
        quantity: take,
        costBase: cb,
        proceeds: proceedsPart,
        fy: fyEnd(d),
        gain: proceedsPart - cb,
        eligible: discountEligible(p.openDate, d),
      });
      p.quantity -= take;
      p.costBase -= cb;
      left -= take;
    }
    this.parcels.set(
      code,
      ps.filter((p) => p.quantity > EPS_QTY),
    );
  }

  private order(ps: Parcel[], ppu: number, sellDate: Date): Parcel[] {
    const arr = [...ps];
    if (this.method === "fifo") {
      return arr.sort((a, b) => a.openDate.getTime() - b.openDate.getTime());
    }
    if (this.method === "lifo") {
      return arr.sort((a, b) => b.openDate.getTime() - a.openDate.getTime());
    }
    // minimise_gain: rank by POST-discount assessable gain per unit, not raw
    // gain — ranking by raw gain ignores the discount and picks the wrong parcel.
    const assessable = (p: Parcel): number => {
      let gu = ppu - perUnit(p);
      if (gu > 0 && discountEligible(p.openDate, sellDate)) gu *= 1 - CGT_DISCOUNT;
      return gu;
    };
    return arr.sort((a, b) => assessable(a) - assessable(b));
  }

  private corporateAction(d: Date, r: CorporateActionRow): void {
    const code = r.code.trim();
    const typ = r.type.trim().toUpperCase();
    const ps = this.parcels.get(code) ?? [];
    if (ps.length === 0) {
      this.warnings.push(`${iso(d)}: ${typ} on ${code} but no holding`);
      return;
    }
    if (typ === "SPLIT" || typ === "BONUS") {
      // Cost base unchanged, spread over the larger unit count; acquisition
      // date RETAINED so CGT discount eligibility survives.
      const ratio = num(r.ratio);
      for (const p of ps) p.quantity *= ratio;
    } else if (typ === "SPINOFF") {
      const retain = num(r.retain_pct);
      const newCode = (r.new_code ?? "").trim();
      const newQty = num(r.new_quantity);
      const totalCb = ps.reduce((s, p) => s + p.costBase, 0);
      const spunCb = totalCb * (1 - retain);
      for (const p of ps) p.costBase *= retain; // parent keeps retain_pct
      this.list(newCode).push({
        code: newCode,
        openDate: d, // new entity acquired at the distribution date
        quantity: newQty,
        costBase: spunCb,
        origin: "SPINOFF",
      });
    } else {
      this.warnings.push(`${iso(d)}: unhandled corporate action ${typ}`);
    }
  }

  /** Current holdings: total units by code, rounded to 4 dp, sorted by code. */
  holdings(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [code, ps] of this.parcels) {
      const q = ps.reduce((s, p) => s + p.quantity, 0);
      if (q > EPS_QTY) out[code] = round4(q);
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  /** Per-FY tax report mapped to ATO labels, oldest → newest. */
  report(): FinancialYearReport[] {
    const fySet = new Set<number>();
    for (const e of this.cgt) fySet.add(fyEnd(e.sellDate));
    for (const i of this.income) fySet.add(this.incomeFy(i));
    const fys = [...fySet].sort((a, b) => a - b);

    const out: FinancialYearReport[] = [];
    let carried = 0; // UNROUNDED running carry-forward across years
    for (const fy of fys) {
      const ev = this.cgt.filter((e) => e.fy === fy);
      const inc = this.income.filter((i) => this.incomeFy(i) === fy);
      const trusts = inc.filter((i) => i.source_type === "TRUST");
      const divs = inc.filter((i) => i.source_type === "DIVIDEND");
      const fgn = inc.filter((i) => i.source_type === "FOREIGN");
      const s = (rows: IncomeRow[], k: keyof IncomeRow): number =>
        round2(rows.reduce((acc, r) => acc + num(r[k] as string | undefined), 0));

      // Capital gains: own disposals + trust-attributed gains.
      const ownDisc = ev.filter((e) => e.gain > 0 && e.eligible).reduce((a, e) => a + e.gain, 0);
      const ownNond = ev.filter((e) => e.gain > 0 && !e.eligible).reduce((a, e) => a + e.gain, 0);
      const ownLoss = -ev.filter((e) => e.gain < 0).reduce((a, e) => a + e.gain, 0);
      const trustDisc = s(trusts, "cg_discounted_grossed");
      const trustOth = s(trusts, "cg_other");

      const carriedIn = carried;
      const netting = computeCgtNetting({
        discountGains: ownDisc + trustDisc,
        nonDiscountGains: ownNond + trustOth,
        lossesThisYear: ownLoss,
        carriedIn,
      });
      carried = netting.carriedForward;

      const item20E = s(trusts, "foreign_income") + s(fgn, "foreign_income");
      const item20O = s(trusts, "foreign_tax") + s(fgn, "foreign_tax");

      out.push({
        fy,
        label: fyLabel(fy),
        item_11T_franked_dividends: s(divs, "franked"),
        item_11S_unfranked_dividends: s(divs, "unfranked"),
        item_11U_franking_credits: s(divs, "franking_credit"),
        item_13U_trust_income: s(trusts, "t13U"),
        item_13C_franked_distributions: s(trusts, "t13C"),
        item_13Q_trust_franking_credits: s(trusts, "t13Q"),
        item_18H_total_capital_gains: round2(netting.totalCapitalGains),
        item_18A_net_capital_gain: round2(netting.netCapitalGain),
        capital_loss_carried_in: round2(carriedIn),
        capital_loss_carried_forward: round2(carried),
        item_20E_foreign_income: round2(item20E),
        item_20O_foreign_tax_offset: round2(item20O),
        item_20F_nz_franking_credit: s(trusts, "nz_franking_credit"),
        amit_cost_base_increase: s(trusts, "amit_increase"),
        amit_cost_base_decrease: s(trusts, "amit_decrease"),
        num_cgt_events: ev.length,
      });
    }
    return out;
  }

  /**
   * Financial year an income row belongs to. DIVIDEND income uses the PAYMENT
   * date (a payment on 2 July falls in the following FY); TRUST/FOREIGN rows
   * carry no pay date and use their fy_end column.
   */
  private incomeFy(i: IncomeRow): number {
    if (i.pay_date && i.pay_date.trim() !== "") return fyEnd(D(i.pay_date));
    return Number(i.fy_end);
  }

  /**
   * Reconcile engine holdings against externally-supplied broker unit counts.
   * Flags — never hides — differences (missing DRP allotments etc.) and raises
   * a warning per shortfall. Never invent a cost base to make it balance.
   */
  reconcile(brokerUnits: Record<string, number>): ReconciliationRow[] {
    const engine = this.holdings();
    const codes = new Set<string>([...Object.keys(engine), ...Object.keys(brokerUnits)]);
    const rows: ReconciliationRow[] = [];
    for (const code of [...codes].sort()) {
      const engineUnits = engine[code] ?? 0;
      const broker = brokerUnits[code] ?? 0;
      const difference = round4(broker - engineUnits);
      let status: ReconStatus;
      if (Math.abs(difference) < EPS_QTY) {
        status = "MATCH";
      } else if (difference > 0) {
        status = "FLAG_MISSING_DRP";
        this.warnings.push(
          `${code}: holding is short ${g(difference)} units — missing DRP allotment`,
        );
      } else {
        status = "FLAG_EXCESS";
        this.warnings.push(
          `${code}: holding is ${g(-difference)} units over broker records — check for an extra parcel`,
        );
      }
      rows.push({ code, engine_units: engineUnits, broker_units: broker, difference, status });
    }
    return rows;
  }
}

export function perUnit(p: Parcel): number {
  return p.quantity ? p.costBase / p.quantity : 0;
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** Compact number formatting to mirror Python's `%g`. */
function g(x: number): string {
  return String(Number(x.toPrecision(6)));
}

/** ISO date (YYYY-MM-DD) for warning messages. */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
