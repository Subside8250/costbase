import { useEffect, useMemo, useState } from "react";
import { buildPortfolio, type RawInputs } from "./portfolio";
import { type SaleMethod } from "./engine";
import { loadState, saveState, clearState, type PersistedState } from "./store";
import { SAMPLE, SAMPLE_BROKER_UNITS } from "./data/sample";
import { exportWorkbook } from "./export";
import { ingestFile } from "./parsers/ingest";
import { downloadBackup, parseBackup } from "./backup";
import { detectCsvType, type CsvKind } from "./detectCsv";
import { appendRows, TXN_HEADERS, INCOME_HEADERS, CA_HEADERS } from "./csvSchema";
import type { PendingItem } from "./components/ReviewPanel";
import type { ViewerDoc } from "./components/PdfTextViewer";
import { ImportView } from "./views/ImportView";
import { HoldingsView } from "./views/HoldingsView";
import { TaxReportView } from "./views/TaxReportView";
import { RecordsView } from "./views/RecordsView";
import { Badge } from "./components/ui";

const EMPTY: PersistedState = {
  transactionsCsv: "",
  corporateActionsCsv: "",
  incomeCsv: "",
  method: "fifo",
  brokerUnits: {},
};

export interface ImportLogEntry {
  name: string;
  status: "applied" | "review" | "text" | "error";
  detail: string;
}

type Tab = "import" | "holdings" | "tax" | "records";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "import", label: "Import" },
  { id: "holdings", label: "Holdings" },
  { id: "tax", label: "Tax Report" },
  { id: "records", label: "Records" },
];

const CSV_SLOT: Record<CsvKind, keyof Pick<PersistedState, "transactionsCsv" | "corporateActionsCsv" | "incomeCsv">> = {
  transactions: "transactionsCsv",
  corporateActions: "corporateActionsCsv",
  income: "incomeCsv",
};

export default function App() {
  const [state, setState] = useState<PersistedState>(EMPTY);
  const [tab, setTab] = useState<Tab>("import");
  const [ready, setReady] = useState(false);

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingNotes, setPendingNotes] = useState<string[]>([]);
  const [viewerDocs, setViewerDocs] = useState<ViewerDoc[]>([]);
  const [importLog, setImportLog] = useState<ImportLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (!cancelled && s) setState({ ...EMPTY, ...s });
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [state, ready]);

  const raw: RawInputs = {
    transactionsCsv: state.transactionsCsv,
    corporateActionsCsv: state.corporateActionsCsv,
    incomeCsv: state.incomeCsv,
    method: state.method,
    brokerUnits: state.brokerUnits,
  };
  const portfolio = useMemo(() => buildPortfolio(raw), [
    state.transactionsCsv,
    state.corporateActionsCsv,
    state.incomeCsv,
    state.method,
    state.brokerUnits,
  ]);

  const hasData = portfolio.transactions.length > 0 || portfolio.income.length > 0;

  function setCsvSlot(kind: CsvKind, text: string) {
    setState((s) => ({ ...s, [CSV_SLOT[kind]]: text }));
  }

  /** Handle dropped/selected files: canonical CSVs apply directly; everything
   * else is parsed into the review queue or shown as text. */
  async function ingestFiles(files: File[]) {
    setBusy(true);
    const log: ImportLogEntry[] = [];
    const newPending: PendingItem[] = [];
    const newViewer: ViewerDoc[] = [];
    const newNotes: string[] = [];
    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".csv")) {
          const text = await file.text();
          const canonical = detectCsvType(text);
          if (canonical) {
            setCsvSlot(canonical, text);
            log.push({ name: file.name, status: "applied", detail: `loaded as ${canonical}` });
            continue;
          }
        }
        const res = await ingestFile(file);
        if (res.error) {
          log.push({ name: file.name, status: "error", detail: res.error });
          continue;
        }
        if (res.result && res.result.items.length > 0) {
          for (const it of res.result.items) {
            newPending.push({ ...it, include: true, docLabel: res.result.docLabel, fileName: file.name });
          }
          newNotes.push(...res.result.notes);
          log.push({
            name: file.name,
            status: "review",
            detail: `${res.result.docLabel} — ${res.result.items.length} item(s) to review`,
          });
        } else {
          newViewer.push({ name: file.name, text: res.rawText });
          log.push({ name: file.name, status: "text", detail: "unrecognised — shown as text" });
        }
      }
      if (newPending.length) setPending((p) => [...p, ...newPending]);
      if (newNotes.length) setPendingNotes((n) => dedupe([...n, ...newNotes]));
      if (newViewer.length) setViewerDocs((v) => [...v, ...newViewer]);
      setImportLog(log);
    } finally {
      setBusy(false);
    }
  }

  function togglePending(id: string) {
    setPending((p) => p.map((it) => (it.id === id ? { ...it, include: !it.include } : it)));
  }
  function editPending(id: string, key: string, value: string) {
    setPending((p) => p.map((it) => (it.id === id ? { ...it, row: { ...it.row, [key]: value } } : it)));
  }
  function discardPending() {
    setPending([]);
    setPendingNotes([]);
  }

  function applyPending() {
    const chosen = pending.filter((p) => p.include);
    if (chosen.length === 0) return;
    const txns = chosen.filter((p) => p.target === "transactions").map((p) => p.row);
    const incomes = chosen.filter((p) => p.target === "income").map((p) => p.row);
    const cas = chosen.filter((p) => p.target === "corporateActions").map((p) => p.row);
    const holds = chosen.filter((p) => p.target === "brokerHoldings").map((p) => p.row);

    setState((s) => {
      const next = { ...s };
      if (txns.length) next.transactionsCsv = appendRows(s.transactionsCsv, txns, TXN_HEADERS);
      if (incomes.length) next.incomeCsv = appendRows(s.incomeCsv, incomes, INCOME_HEADERS);
      if (cas.length) next.corporateActionsCsv = appendRows(s.corporateActionsCsv, cas, CA_HEADERS);
      if (holds.length) {
        const bu = { ...s.brokerUnits };
        for (const h of holds) bu[h.code] = Number(h.units);
        next.brokerUnits = bu;
      }
      return next;
    });
    setPending([]);
    setPendingNotes([]);
    setImportLog([{ name: "", status: "applied", detail: `Applied ${chosen.length} reviewed item(s).` }]);
  }

  function loadSample() {
    setState({
      transactionsCsv: SAMPLE.transactionsCsv,
      corporateActionsCsv: SAMPLE.corporateActionsCsv,
      incomeCsv: SAMPLE.incomeCsv,
      method: "fifo",
      brokerUnits: SAMPLE_BROKER_UNITS,
    });
    discardPending();
    setViewerDocs([]);
    setImportLog([]);
  }

  function clearAll() {
    setState(EMPTY);
    discardPending();
    setViewerDocs([]);
    setImportLog([]);
    void clearState();
  }

  function backup() {
    downloadBackup(state);
  }

  async function restore(file: File) {
    try {
      const restored = parseBackup(await file.text());
      setState(restored);
      discardPending();
      setViewerDocs([]);
      setImportLog([{ name: file.name, status: "applied", detail: "restored from backup" }]);
    } catch (err) {
      setImportLog([
        { name: file.name, status: "error", detail: err instanceof Error ? err.message : String(err) },
      ]);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-white">
                CB
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">CostBase</h1>
                <p className="text-xs text-slate-500">
                  Australian share portfolio &amp; tax report · AUD · FY 1 Jul – 30 Jun
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="blue">Method: {state.method}</Badge>
              <button
                disabled={!hasData}
                onClick={() => exportWorkbook(portfolio)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export to Excel
              </button>
            </div>
          </div>

          <nav className="mt-4 flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="bg-amber-50">
        <div className="mx-auto max-w-6xl px-6 py-2 text-center text-xs text-amber-800">
          <strong>Calculation aid, not tax advice.</strong> Figures are estimates to help you
          prepare — confirm with a registered tax agent. All data stays on this device; nothing is
          uploaded.
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {!ready ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
        ) : tab === "import" ? (
          <ImportView
            method={state.method}
            portfolio={portfolio}
            hasData={hasData}
            busy={busy}
            importLog={importLog}
            pending={pending}
            pendingNotes={pendingNotes}
            viewerDocs={viewerDocs}
            onFiles={ingestFiles}
            onLoadSample={loadSample}
            onClear={clearAll}
            onBackup={backup}
            onRestore={restore}
            onMethod={(m: SaleMethod) => setState((s) => ({ ...s, method: m }))}
            onTogglePending={togglePending}
            onEditPending={editPending}
            onApplyPending={applyPending}
            onDiscardPending={discardPending}
            onClearViewer={() => setViewerDocs([])}
          />
        ) : tab === "holdings" ? (
          <HoldingsView portfolio={portfolio} />
        ) : tab === "tax" ? (
          <TaxReportView portfolio={portfolio} />
        ) : (
          <RecordsView
            portfolio={portfolio}
            onTransactions={(rows) => setState((s) => ({ ...s, transactionsCsv: appendRows("", rows, TXN_HEADERS) }))}
            onCorporateActions={(rows) =>
              setState((s) => ({ ...s, corporateActionsCsv: appendRows("", rows, CA_HEADERS) }))
            }
            onIncome={(rows) => setState((s) => ({ ...s, incomeCsv: appendRows("", rows, INCOME_HEADERS) }))}
          />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-2 text-center text-xs text-slate-400">
        CostBase · fully client-side · no analytics, no network calls in core features
      </footer>
    </div>
  );
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
