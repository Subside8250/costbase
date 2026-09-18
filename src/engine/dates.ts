/**
 * Date helpers for Australian financial-year tax logic.
 *
 * Dates are represented as UTC-midnight `Date` objects so there is no timezone
 * drift. Parse only via `D()` so the whole engine shares one representation.
 */

/** Parse a "YYYY-MM-DD" string into a UTC-midnight Date. */
export function D(s: string): Date {
  const [y, m, d] = s.trim().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Financial year ENDING year for a date. AU FY runs 1 Jul – 30 Jun. */
export function fyEnd(d: Date): number {
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 6 ? y + 1 : y; // month is 0-based; 6 = July
}

/** Human label for a FY ending year, e.g. 2026 → "FY2025-26". */
export function fyLabel(fy: number): string {
  return `FY${fy - 1}-${String(fy).slice(2)}`;
}

/**
 * Add `n` years to a date, mapping 29 Feb → 28 Feb when the target year is not
 * a leap year (matches Python's `date.replace(year=…)` fallback).
 */
export function addYears(d: Date, n: number): Date {
  const y = d.getUTCFullYear() + n;
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (m === 1 && day === 29 && !isLeap(y)) {
    return new Date(Date.UTC(y, 1, 28));
  }
  return new Date(Date.UTC(y, m, day));
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * CGT discount eligibility — the CALENDAR rule, not a day count.
 *
 * The asset must be held MORE than 12 months: eligible iff
 * `sellDate > addYears(openDate, 1)`. A naive "held ≥ 365/366 days" test
 * wrongly grants the discount at exactly 12 months when the period spans a
 * leap day. This was a real bug; a test guards it.
 */
export function discountEligible(openDate: Date, sellDate: Date): boolean {
  return sellDate.getTime() > addYears(openDate, 1).getTime();
}
