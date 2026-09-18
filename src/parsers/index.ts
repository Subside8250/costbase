import type { DocParser, ParseResult, ParserInput } from "./types";
import { cmcTradingCsvParser } from "./cmcTradingCsv";
import { cmcPortfolioCsvParser } from "./cmcPortfolioCsv";
import { cmcTradingPdfParser } from "./cmcTradingPdf";
import { ammaTaxParser } from "./ammaTaxStatement";
import { vanguardAnnualParser } from "./vanguardAnnual";
import { nabDividendParser } from "./nabDividend";

/** Registered document parsers, tried in order; first match wins. */
export const PARSERS: DocParser[] = [
  cmcTradingCsvParser,
  cmcPortfolioCsvParser,
  cmcTradingPdfParser,
  ammaTaxParser,
  vanguardAnnualParser,
  nabDividendParser,
];

export function parseInput(input: ParserInput): ParseResult | null {
  for (const p of PARSERS) {
    if (p.detect(input)) return p.parse(input);
  }
  return null;
}

export type { DocParser, ParseResult, ParserInput, ExtractedItem, ParsedTarget } from "./types";
