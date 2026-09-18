import { useState } from "react";
import { Card } from "./ui";

export interface ViewerDoc {
  name: string;
  text: string;
}

/** Fallback for documents no parser recognised: show the extracted text so the
 * user can read/copy figures into manual entry. Nothing here is auto-imported. */
export function PdfTextViewer({ docs, onClear }: { docs: ViewerDoc[]; onClear: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (docs.length === 0) return null;
  return (
    <Card
      title="Unrecognised documents — extracted text"
      subtitle="These weren't in a format I can parse, so nothing was imported. The text is shown for you to copy into manual entry."
      right={
        <button
          onClick={onClear}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Clear
        </button>
      }
    >
      <ul className="space-y-2">
        {docs.map((d, i) => (
          <li key={i} className="rounded-lg border border-slate-100">
            <button
              onClick={() => setOpen((o) => ({ ...o, [d.name]: !o[d.name] }))}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="font-mono text-xs">{d.name}</span>
              <span className="text-slate-400">{open[d.name] ? "Hide" : "Show text"}</span>
            </button>
            {open[d.name] && (
              <pre className="max-h-80 overflow-auto border-t border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                {d.text || "(no extractable text — this may be a scanned image)"}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
