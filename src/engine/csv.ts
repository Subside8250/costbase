/**
 * Minimal, dependency-free CSV parser used by the engine and tests.
 *
 * Handles quoted fields, escaped quotes ("") and CRLF/LF line endings, and
 * strips a UTF-8 BOM. Returns an array of records keyed by the header row.
 * The UI layer may use PapaParse instead; the engine stays dependency-free so
 * it is unit-testable in isolation.
 */
export function parseCsv<T = Record<string, string>>(text: string): T[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  const out: T[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip blank trailing lines.
    if (cells.length === 1 && cells[0] === "") continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = cells[c] ?? "";
    }
    out.push(rec as T);
  }
  return out;
}

/**
 * Serialize records back to CSV using an explicit header order. Fields
 * containing a comma, quote or newline are quoted with doubled inner quotes.
 */
export function stringifyCsv(
  rows: Array<Record<string, string | undefined>>,
  headers: string[],
): string {
  const esc = (v: string): string =>
    /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

function parseRows(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch === "\r") {
      // handled by the \n branch; ignore standalone \r
    } else {
      field += ch;
    }
  }
  // flush final field/row if the file did not end with a newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
