const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AUD_SIGNED = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

/** AUD money, e.g. "$1,320.17". Blank for null/undefined. */
export function money(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "—";
  return AUD.format(x);
}

/** AUD with an explicit sign, for gains/losses. */
export function signedMoney(x: number): string {
  return AUD_SIGNED.format(x);
}

/** Unit counts, up to 4 dp, no trailing zeros. */
export function units(x: number): string {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(x);
}

/** ISO date (YYYY-MM-DD) from a UTC Date. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
