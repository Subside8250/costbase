# CostBase

A fully client-side, browser-based Australian share portfolio tracker and tax
report generator. Base currency AUD; financial year 1 Jul – 30 Jun (labelled by
the ending year). **Calculation aid, not tax advice.**

Everything runs in your browser. Data is parsed in-page and persisted only to
IndexedDB on your device — there are no network calls, and nothing you import is
ever uploaded, even when the app itself is served from a static host.

## Quick start

```bash
npm install
npm test      # engine + parser unit tests
npm run dev   # http://localhost:5173
```

`npm run build` type-checks and produces a static bundle in `dist/`.

Open the app and click **Load sample data** to populate it with a small built-in
demo (fictional holdings), or drag-drop your own CSV/PDF statements on the Import
tab. Your imported data can be exported/reimported via **Backup / Restore**.

## Architecture

- **`src/engine/`** — the tax engine: pure, dependency-free TypeScript with no
  DOM and no React, so it is unit-testable in isolation. Ported faithfully from
  `reference/engine.py`.
  - `dates.ts` — FY mapping and the **calendar-based** CGT discount rule
    (`sell > addYears(open, 1)`, not a day count).
  - `cgt.ts` — per-FY capital-gains netting with loss carry-forward (losses
    reduce non-discount gains, then discount gains, *before* the 50% discount).
  - `round.ts` — `round2`, a faithful replica of Python's `round(x, 2)`
    (round-half-to-even on the exact binary value). JS `toFixed`/`Math.round`
    round half-up and would break the golden master.
  - `engine.ts` — ingest, FIFO/LIFO/minimise-gain sale allocation, corporate
    actions (SPLIT/BONUS/SPINOFF), the per-FY report, and holdings
    reconciliation.
  - `csv.ts` — a small quote-aware CSV parser/serializer (keeps the engine
    dependency-free).
- **`src/`** — React UI (Vite + Tailwind): CSV/PDF import with review, holdings
  with parcels, per-FY tax report mapped to ATO labels with a caveats panel, a
  **Records** tab with add/edit/delete editors for transactions, corporate
  actions and income (for events with no statement — splits, spin-offs — or
  figures you estimate), a warnings panel, Excel export (SheetJS) and IndexedDB
  persistence. Rows whose source/notes mention "assumption" are tagged so
  estimates stay visible for confirmation.

## Importing statements (CSV + PDF)

Drop CSVs or PDFs straight from your providers on the Import tab. File type is
detected automatically and PDFs are text-extracted **in the browser** (pdf.js,
lazy-loaded) — nothing is uploaded. Recognised documents are parsed into an
**extract-and-confirm review table**: every figure is shown and editable, and
nothing reaches the tax engine until you click *Apply*.

Supported formats (parsers in `src/parsers/`):

| Document | Produces |
|---|---|
| CMC "Trading Account Statement" CSV | BUY/SELL transactions (Debit/Credit = AUD consideration) |
| CMC "PortfolioReport-Equities" CSV | Broker holdings for reconciliation |
| Betashares / Vanguard AMIT **tax** statement (PDF) | Trust income row — 13U/13C/13Q, foreign 20E/20O/20F, AMIT cost-base adjustments, and the discounted/other CGT split derived from the two Part A totals |
| Vanguard ETF **annual** statement (PDF) | DRP allotments with unit prices (closes DRP cost-base gaps) |
| NAB (Computershare) dividend statement (PDF) | Dividend income (11T/11S/11U) + DRP allotment |

The three canonical schema CSVs (`transactions.csv`, `corporate_actions.csv`,
`income.csv`) are still recognised and applied directly. Foreign dividends seen
in the CMC ledger are only *net cash*, so they are flagged (not imported) — 20E
needs the gross figure from the CMC International Dividends statement.
Unrecognised files fall back to a text viewer so you can copy figures manually.

## Correctness

The TypeScript engine is ported from `reference/engine.py` and is covered by a
Vitest suite: the calendar-based CGT discount boundary, the loss carry-forward
chain, FIFO/LIFO/minimise-gain allocation, corporate actions, the payment-date
FY rule, `round2` (Python-compatible banker's rounding), the statement parsers,
and backup/restore. `npm test` runs them.

## Privacy

No analytics, no network calls in the core features, and no server — imported
data lives only in your browser's IndexedDB. When hosted (e.g. GitHub Pages)
only the static app is served; your data never leaves your device. Use
**Backup** to save a JSON snapshot and **Restore** to load it on another device.

## Deferred (flagged in the UI, never faked)

Live prices, return of capital (CGT event E4), and non-individual entity types.
Data-quality gaps (unknown DRP prices, gross foreign income, corporate-action
details) are surfaced as caveats, never computed around.

## Disclaimer

Calculation aid, not tax advice. Verify every figure against your own
statements and confirm your return with a registered tax agent.
