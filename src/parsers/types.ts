/** Types for the document-import (extract-and-confirm) pipeline. */

export type ParsedTarget = "transactions" | "income" | "corporateActions" | "brokerHoldings";

/** One extracted candidate row, shown in the review table before it is
 * committed. `row` is keyed by the canonical CSV columns for its target
 * (or `{ code, units }` for brokerHoldings). Nothing is trusted until the
 * user confirms it. */
export interface ExtractedItem {
  id: string;
  target: ParsedTarget;
  row: Record<string, string>;
  summary: string;
  /** Per-item caveat (e.g. a figure the user should double-check). */
  flag?: string;
}

export interface ParseResult {
  parser: string;
  docLabel: string;
  fileName: string;
  items: ExtractedItem[];
  /** Document-level caveats to surface in the review panel. */
  notes: string[];
}

export interface ParserInput {
  fileName: string;
  kind: "csv" | "pdf";
  /** Raw CSV text, or the joined PDF text. */
  text: string;
  /** Reconstructed visual lines (PDF) or raw CSV lines. */
  lines: string[];
  /** Parsed CSV rows (CSV only). */
  csv?: Array<Record<string, string>>;
}

export interface DocParser {
  id: string;
  label: string;
  detect(input: ParserInput): boolean;
  parse(input: ParserInput): ParseResult;
}
