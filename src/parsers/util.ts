/** Shared parsing helpers: numbers, dates, currency, line search. */

/** Parse a numeric string that may carry $, commas, or space thousands
 * separators (CMC prints "1 797.3500"). Parentheses denote negatives. */
export function parseNum(s: string | undefined | null): number {
  if (s == null) return NaN;
  let t = s.trim();
  if (t === "" || t === "-") return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[$,\s]/g, "");
  const n = Number(t);
  return neg ? -n : n;
}

/** Fixed 2-dp string for a consideration/amount value. */
export function money2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "03/07/2025" → "2025-07-03". Returns "" if not a DD/MM/YYYY date. */
export function dmyToIso(s: string): string {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "2 July 2026" → "2026-07-02". Returns "" if unparseable. */
export function longDateToIso(s: string): string {
  const m = s.trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return "";
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return "";
  return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Australian financial-year ending year for an ISO date (1 Jul – 30 Jun). */
export function fyEndFromIso(iso: string): number {
  const [y, mo] = iso.split("-").map(Number);
  return mo >= 7 ? y + 1 : y;
}

/** First line matching a pattern. */
export function findLine(lines: string[], re: RegExp): string | undefined {
  return lines.find((l) => re.test(l));
}

/** The last currency amount on a line, e.g. "…13U $63.58" → 63.58. */
export function lastCurrencyOnLine(line: string): number {
  const all = line.match(/-?\$?\(?-?[\d,]+\.\d{2}\)?/g);
  if (!all || all.length === 0) return NaN;
  return parseNum(all[all.length - 1]);
}

/**
 * Amount for a labelled row: find the first line containing `label`, then read
 * the last currency on that line; if the line has none, scan up to `lookahead`
 * following lines for the first currency. Returns NaN if nothing found.
 */
export function amountForLabel(
  lines: string[],
  label: RegExp,
  lookahead = 2,
): number {
  const idx = lines.findIndex((l) => label.test(l));
  if (idx === -1) return NaN;
  const here = lastCurrencyOnLine(lines[idx]);
  if (!Number.isNaN(here)) return here;
  for (let i = idx + 1; i <= idx + lookahead && i < lines.length; i++) {
    const v = lastCurrencyOnLine(lines[i]);
    if (!Number.isNaN(v)) return v;
  }
  return NaN;
}

let counter = 0;
/** Stable-enough id for a review-table row within one import batch. */
export function itemId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
