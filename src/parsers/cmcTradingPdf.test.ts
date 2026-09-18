import { describe, expect, it } from "vitest";
import { parseInput, type ParseResult } from "./index";

function pdf(lines: string[]): ParseResult | null {
  return parseInput({ fileName: "eofy.pdf", kind: "pdf", text: lines.join("\n"), lines });
}

describe("CMC trading account statement (PDF) → transactions", () => {
  const lines = [
    "MR SAMPLE PERSON Trading Account Statement",
    "Period: 01/07/2024 - 30/06/2025",
    "01/07/2024 12345678 Bght 100 SMPLX @ 20.0000 AUD 2,000.00 2,000.00",
    "15/08/2024 12345679 Bght 10 SMPLZ:US @ 150.0000 AUD 1,500.00 3,500.00",
    "28/07/2024 3544277 JNL3544277 SMPLZ:US Intl Div Ex:27/06/24 3.39 3.39Cr",
    "20/03/2025 12345680 Sold 100 SMPLX @ 26.0000 AUD 2,600.00 900.00Cr",
    "05/02/2025 6800516 Dep ANZA CASH ACTIVE 014-936 111853057 1,000.00 0.00",
  ];

  it("extracts buys and sells with the AUD consideration (first amount after AUD)", () => {
    const r = pdf(lines)!;
    expect(r.parser).toBe("cmc-trading-pdf");
    const txns = r.items.filter((i) => i.target === "transactions");
    expect(txns).toHaveLength(3);
    expect(txns[0].row).toMatchObject({ date: "2024-07-01", action: "BUY", code: "SMPLX", quantity: "100", consideration_aud: "2000.00", market: "ASX" });
    expect(txns[1].row).toMatchObject({ action: "BUY", code: "SMPLZ", market: "US", consideration_aud: "1500.00" });
    expect(txns[2].row).toMatchObject({ action: "SELL", code: "SMPLX", consideration_aud: "2600.00", date: "2025-03-20" });
  });

  it("notes foreign dividends (net cash) rather than importing them, and ignores cash sweeps", () => {
    const r = pdf(lines)!;
    expect(r.items.some((i) => i.target === "income")).toBe(false);
    expect(r.notes.join(" ")).toMatch(/international dividend/i);
  });
});
