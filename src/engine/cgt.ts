/** Per-financial-year capital-gains netting with loss carry-forward. */

export const CGT_DISCOUNT = 0.5;

export interface CgtNettingInput {
  /** Discount-eligible gains: own eligible gains + trust cg_discounted_grossed. */
  discountGains: number;
  /** Non-eligible gains: own non-eligible gains + trust cg_other. */
  nonDiscountGains: number;
  /** Capital losses realised THIS financial year (a positive number). */
  lossesThisYear: number;
  /** Losses carried in from the prior FY (a positive number). */
  carriedIn: number;
}

export interface CgtNettingResult {
  /** ATO 18A — net capital gain after applying losses then the 50% discount. */
  netCapitalGain: number;
  /** Losses to carry into the next FY. */
  carriedForward: number;
  /** ATO 18H — total capital gains (gross, before losses/discount). */
  totalCapitalGains: number;
}

/**
 * Losses reduce fully-taxed (non-discount) gains first, then discountable
 * gains, BEFORE the 50% discount is applied. Trust-attributed capital gains go
 * through this same calculation. All arithmetic mirrors reference/engine.py so
 * the running carry-forward stays bit-for-bit identical across years.
 */
export function computeCgtNetting(input: CgtNettingInput): CgtNettingResult {
  const { discountGains, nonDiscountGains, lossesThisYear, carriedIn } = input;
  const available = lossesThisYear + carriedIn;
  const ndAfter = Math.max(0, nonDiscountGains - available);
  const remaining = Math.max(0, available - nonDiscountGains);
  const dAfter = Math.max(0, discountGains - remaining);
  const netCapitalGain = ndAfter + dAfter * (1 - CGT_DISCOUNT);
  const carriedForward = Math.max(0, remaining - discountGains);
  return {
    netCapitalGain,
    carriedForward,
    totalCapitalGains: discountGains + nonDiscountGains,
  };
}
