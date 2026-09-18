import { useRef, useState, type DragEvent } from "react";
import type { Portfolio } from "../portfolio";
import type { SaleMethod } from "../engine";
import { Badge, Card, Empty, Td, Th } from "../components/ui";
import { WarningsPanel } from "../components/WarningsPanel";
import { ReviewPanel, type PendingItem } from "../components/ReviewPanel";
import { PdfTextViewer, type ViewerDoc } from "../components/PdfTextViewer";
import type { ImportLogEntry } from "../App";
import { units } from "../format";

interface Props {
  method: SaleMethod;
  portfolio: Portfolio;
  hasData: boolean;
  busy: boolean;
  importLog: ImportLogEntry[];
  pending: PendingItem[];
  pendingNotes: string[];
  viewerDocs: ViewerDoc[];
  onFiles: (files: File[]) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
  onMethod: (m: SaleMethod) => void;
  onTogglePending: (id: string) => void;
  onEditPending: (id: string, key: string, value: string) => void;
  onApplyPending: () => void;
  onDiscardPending: () => void;
  onClearViewer: () => void;
}

const METHOD_LABEL: Record<SaleMethod, string> = {
  fifo: "FIFO (first in, first out)",
  lifo: "LIFO (last in, first out)",
  minimise_gain: "Minimise gain (lowest post-discount assessable gain)",
};

const STATUS_TONE: Record<ImportLogEntry["status"], "green" | "blue" | "amber" | "red"> = {
  applied: "green",
  review: "blue",
  text: "amber",
  error: "red",
};

export function ImportView(props: Props) {
  const { portfolio } = props;
  const restoreRef = useRef<HTMLInputElement>(null);

  const status = [
    { label: "Transactions", count: portfolio.transactions.length, filled: portfolio.transactions.length > 0 },
    { label: "Corporate actions", count: portfolio.corporateActions.length, filled: portfolio.corporateActions.length > 0 },
    { label: "Income", count: portfolio.income.length, filled: portfolio.income.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <Card
        title="Import statements"
        subtitle="Drop CSVs or PDFs from CMC, NAB, Vanguard or Betashares. File type is detected automatically; parsed data goes to a review step before it's used. Everything stays in your browser."
        right={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={props.onLoadSample}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              Load sample data
            </button>
            <button
              onClick={() => restoreRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Restore backup
            </button>
            {props.hasData && (
              <button
                onClick={props.onBackup}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Backup
              </button>
            )}
            {props.hasData && (
              <button
                onClick={props.onClear}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear all
              </button>
            )}
            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (!props.hasData || window.confirm("Restore will replace your current data. Continue?")) {
                    props.onRestore(f);
                  }
                }
                e.target.value = "";
              }}
            />
          </div>
        }
      >
        <FileDrop onFiles={props.onFiles} busy={props.busy} />

        {props.importLog.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {props.importLog.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                {r.name && <span className="font-mono text-xs text-slate-500">{r.name}</span>}
                <span className="text-slate-500">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                s.filled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
            >
              {s.filled ? "✓" : "○"} {s.label}
              {s.filled && <span className="text-emerald-500">· {s.count} rows</span>}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-500">Sale allocation method</label>
          <select
            value={props.method}
            onChange={(e) => props.onMethod(e.target.value as SaleMethod)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            {(Object.keys(METHOD_LABEL) as SaleMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        {portfolio.parseError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Parse error: {portfolio.parseError}
          </div>
        )}
      </Card>

      <ReviewPanel
        pending={props.pending}
        notes={props.pendingNotes}
        onToggle={props.onTogglePending}
        onEdit={props.onEditPending}
        onApply={props.onApplyPending}
        onDiscard={props.onDiscardPending}
      />

      <PdfTextViewer docs={props.viewerDocs} onClear={props.onClearViewer} />

      {props.hasData && (
        <>
          <WarningsPanel warnings={portfolio.warnings} />

          <Card
            title="Holdings reconciliation at 30 Jun 2026"
            subtitle="Engine units vs broker records. Shortfalls are flagged — never hidden or back-filled with a fake cost base."
          >
            {portfolio.reconciliation.length === 0 ? (
              <Empty>No holdings to reconcile.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>Code</Th>
                      <Th align="right">Engine units</Th>
                      <Th align="right">Broker units</Th>
                      <Th align="right">Difference</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {portfolio.reconciliation.map((r) => (
                      <tr key={r.code}>
                        <Td className="font-medium">{r.code}</Td>
                        <Td align="right" mono>
                          {units(r.engine_units)}
                        </Td>
                        <Td align="right" mono>
                          {units(r.broker_units)}
                        </Td>
                        <Td align="right" mono>
                          {r.difference === 0 ? "—" : units(r.difference)}
                        </Td>
                        <Td>
                          {r.status === "MATCH" ? (
                            <Badge tone="green">Match</Badge>
                          ) : r.status === "FLAG_MISSING_DRP" ? (
                            <Badge tone="amber">Short — missing DRP</Badge>
                          ) : (
                            <Badge tone="red">Excess units</Badge>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function FileDrop({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
        dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="text-3xl text-slate-300" aria-hidden>
        {busy ? "⏳" : "⬆"}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-700">
        {busy ? "Reading files…" : "Drop CSV or PDF files here, or click to browse"}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        CMC trading CSV/holdings · NAB dividends · Vanguard &amp; Betashares statements — detected
        automatically. Drop several at once.
      </div>
    </div>
  );
}
