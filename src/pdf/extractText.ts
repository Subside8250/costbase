/**
 * Client-side PDF → text, with visual-line reconstruction.
 *
 * pdf.js returns text as positioned fragments; statement parsers need whole
 * visual lines ("Franked distributions from trusts   13C   $102.88"), so we
 * group fragments by their y coordinate and order each line left-to-right.
 * Runs entirely in the browser — the PDF is never uploaded.
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface Frag {
  str: string;
  x: number;
  y: number;
}

// Load pdf.js lazily so its ~500 KB only ships when a PDF is actually imported.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Extract a PDF's text as reconstructed visual lines, in reading order. */
export async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const frags: Frag[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const str = item.str;
        if (str === "") continue;
        frags.push({ str, x: item.transform[4], y: item.transform[5] });
      }
      lines.push(...groupIntoLines(frags));
    }
  } finally {
    await doc.destroy();
  }
  return lines;
}

/** Join reconstructed lines into a single text blob (handy for detection). */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  return (await extractPdfLines(data)).join("\n");
}

function groupIntoLines(frags: Frag[]): string[] {
  if (frags.length === 0) return [];
  // Bucket by y (PDF origin is bottom-left, so larger y = higher on the page).
  const rows: Frag[][] = [];
  const sorted = [...frags].sort((a, b) => b.y - a.y || a.x - b.x);
  const TOL = 3; // points; fragments within this vertical distance share a line
  for (const f of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - f.y) <= TOL) {
      row.push(f);
    } else {
      rows.push([f]);
    }
  }
  return rows.map((row) =>
    row
      .sort((a, b) => a.x - b.x)
      .map((f) => f.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
