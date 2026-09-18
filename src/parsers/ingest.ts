/**
 * Browser-facing file ingestion: turn a dropped File (CSV or PDF) into a
 * ParseResult, entirely client-side. PDFs are text-extracted with pdf.js and
 * never uploaded. Falls back to raw extracted text when no parser recognises
 * the document, so the user can still read/copy it.
 */
import { parseCsv } from "../engine";
import { extractPdfLines } from "../pdf/extractText";
import { parseInput, type ParseResult } from "./index";

export interface IngestResult {
  fileName: string;
  kind: "csv" | "pdf" | "unsupported";
  result: ParseResult | null;
  /** Extracted text (PDF) or raw text (CSV) for the fallback viewer. */
  rawText: string;
  error?: string;
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const name = file.name;
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".csv")) {
      const text = await file.text();
      const csv = parseCsv(text);
      const result = parseInput({
        fileName: name,
        kind: "csv",
        text,
        lines: text.split(/\r?\n/),
        csv,
      });
      return { fileName: name, kind: "csv", result, rawText: text };
    }
    if (lower.endsWith(".pdf")) {
      const buf = await file.arrayBuffer();
      const lines = await extractPdfLines(buf);
      const text = lines.join("\n");
      const result = parseInput({ fileName: name, kind: "pdf", text, lines });
      return { fileName: name, kind: "pdf", result, rawText: text };
    }
    return {
      fileName: name,
      kind: "unsupported",
      result: null,
      rawText: "",
      error: "Only .csv and .pdf files are supported.",
    };
  } catch (err) {
    return {
      fileName: name,
      kind: lower.endsWith(".pdf") ? "pdf" : "csv",
      result: null,
      rawText: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
