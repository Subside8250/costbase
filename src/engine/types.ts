/** Row shapes matching the canonical fixture CSV schemas, plus engine outputs. */

/** transactions.csv — actions: BUY, SELL, DRP. */
export interface TxnRow {
  date: string;
  action: string; // BUY | SELL | DRP
  market: string;
  code: string;
  quantity: string;
  consideration_aud: string; // net of brokerage/GST/fees per CMC
  currency?: string;
  fx_note?: string;
  source?: string;
  notes?: string;
}

/** corporate_actions.csv — types: SPLIT, BONUS, SPINOFF. */
export interface CorporateActionRow {
  date: string;
  code: string;
  type: string; // SPLIT | BONUS | SPINOFF
  ratio?: string;
  new_code?: string;
  new_quantity?: string;
  retain_pct?: string;
  source?: string;
  notes?: string;
}

/** income.csv — source_type: DIVIDEND, TRUST, FOREIGN. */
export interface IncomeRow {
  fy_end: string;
  source_type: string; // DIVIDEND | TRUST | FOREIGN
  code: string;
  pay_date?: string;
  franked?: string;
  unfranked?: string;
  franking_credit?: string;
  t13U?: string;
  t13C?: string;
  t13Q?: string;
  cg_discounted_grossed?: string;
  cg_other?: string;
  foreign_income?: string;
  foreign_tax?: string;
  nz_franking_credit?: string;
  amit_increase?: string;
  amit_decrease?: string;
  source?: string;
  notes?: string;
}

export type SaleMethod = "fifo" | "lifo" | "minimise_gain";

export type ParcelOrigin = "BUY" | "DRP" | "SPINOFF" | "BONUS";

export interface Parcel {
  code: string;
  openDate: Date; // original acquisition date (survives splits/bonuses)
  quantity: number;
  costBase: number; // AUD, includes brokerage/GST/fees
  origin: ParcelOrigin;
}

export interface CGTEvent {
  code: string;
  openDate: Date;
  sellDate: Date;
  quantity: number;
  costBase: number;
  proceeds: number;
  fy: number;
  gain: number; // proceeds - costBase
  eligible: boolean; // CGT discount eligible
}

/** Per-financial-year report, mapped to ATO item labels. */
export interface FinancialYearReport {
  fy: number;
  label: string;
  item_11T_franked_dividends: number;
  item_11S_unfranked_dividends: number;
  item_11U_franking_credits: number;
  item_13U_trust_income: number;
  item_13C_franked_distributions: number;
  item_13Q_trust_franking_credits: number;
  item_18H_total_capital_gains: number;
  item_18A_net_capital_gain: number;
  capital_loss_carried_in: number;
  capital_loss_carried_forward: number;
  item_20E_foreign_income: number;
  item_20O_foreign_tax_offset: number;
  item_20F_nz_franking_credit: number;
  amit_cost_base_increase: number;
  amit_cost_base_decrease: number;
  num_cgt_events: number;
}

export type ReconStatus = "MATCH" | "FLAG_MISSING_DRP" | "FLAG_EXCESS";

export interface ReconciliationRow {
  code: string;
  engine_units: number;
  broker_units: number;
  difference: number; // broker - engine
  status: ReconStatus;
}
