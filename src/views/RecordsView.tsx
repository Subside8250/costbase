import { useState } from "react";
import type { Portfolio } from "../portfolio";
import { Badge } from "../components/ui";
import { RecordEditor, type FieldDef, type RecordRow } from "../components/RecordEditor";

interface Props {
  portfolio: Portfolio;
  onTransactions: (rows: RecordRow[]) => void;
  onCorporateActions: (rows: RecordRow[]) => void;
  onIncome: (rows: RecordRow[]) => void;
}

type Section = "transactions" | "corporateActions" | "income";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "transactions", label: "Transactions" },
  { id: "corporateActions", label: "Corporate actions" },
  { id: "income", label: "Income" },
];

const TXN_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", primary: true, placeholder: "YYYY-MM-DD" },
  { key: "action", label: "Action", type: "select", options: ["BUY", "SELL", "DRP"], primary: true },
  { key: "market", label: "Market" },
  { key: "code", label: "Code", primary: true },
  { key: "quantity", label: "Quantity", primary: true },
  { key: "consideration_aud", label: "Consideration (AUD)", primary: true },
  { key: "currency", label: "Currency" },
  { key: "fx_note", label: "FX note" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
];

const CA_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", primary: true, placeholder: "YYYY-MM-DD" },
  { key: "code", label: "Code", primary: true },
  { key: "type", label: "Type", type: "select", options: ["SPLIT", "BONUS", "SPINOFF"], primary: true },
  { key: "ratio", label: "Ratio (SPLIT/BONUS)", primary: true },
  { key: "new_code", label: "New code (SPINOFF)", primary: true },
  { key: "new_quantity", label: "New quantity (SPINOFF)" },
  { key: "retain_pct", label: "Retain % (SPINOFF, e.g. 0.8834)" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
];

const INCOME_FIELDS: FieldDef[] = [
  { key: "fy_end", label: "FY end", primary: true, placeholder: "e.g. 2026" },
  { key: "source_type", label: "Source type", type: "select", options: ["DIVIDEND", "TRUST", "FOREIGN"], primary: true },
  { key: "code", label: "Code", primary: true },
  { key: "pay_date", label: "Pay date (DIVIDEND)", placeholder: "YYYY-MM-DD" },
  { key: "franked", label: "11T Franked", primary: true },
  { key: "unfranked", label: "11S Unfranked" },
  { key: "franking_credit", label: "11U Franking credit" },
  { key: "t13U", label: "13U Trust income" },
  { key: "t13C", label: "13C Franked distribution", primary: true },
  { key: "t13Q", label: "13Q Trust franking credit" },
  { key: "cg_discounted_grossed", label: "CGT discounted (grossed up)" },
  { key: "cg_other", label: "CGT other method" },
  { key: "foreign_income", label: "20E Foreign income (gross)", primary: true },
  { key: "foreign_tax", label: "20O Foreign tax offset" },
  { key: "nz_franking_credit", label: "20F NZ franking credit" },
  { key: "amit_increase", label: "AMIT cost-base increase" },
  { key: "amit_decrease", label: "AMIT cost-base decrease" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
];

const blank = (fields: FieldDef[], defaults: RecordRow): RecordRow => {
  const r: RecordRow = {};
  for (const f of fields) r[f.key] = defaults[f.key] ?? "";
  return r;
};

export function RecordsView({ portfolio, onTransactions, onCorporateActions, onIncome }: Props) {
  const [section, setSection] = useState<Section>("transactions");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                section === s.id ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Edit anything imported, or add rows by hand — for events with no statement (splits,
          spin-offs) or figures you had to estimate.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-900">
        <Badge tone="blue">tip</Badge>{" "}
        For any figure you estimate rather than take from a statement, put “assumption” in the
        Source or Notes field — it'll be tagged here and flagged as a caveat so you remember to
        confirm it.
      </div>

      {section === "transactions" && (
        <RecordEditor
          title="Transactions"
          subtitle="BUY / SELL / DRP. Consideration is net of brokerage, GST and fees (as CMC reports it)."
          rows={portfolio.transactions as unknown as RecordRow[]}
          fields={TXN_FIELDS}
          makeBlank={() => blank(TXN_FIELDS, { action: "BUY", market: "ASX", currency: "AUD" })}
          onChange={onTransactions}
          addLabel="Add transaction"
          rowBadge={(r) => (
            <Badge tone={r.action === "SELL" ? "red" : r.action === "DRP" ? "blue" : "green"}>
              {r.action || "?"}
            </Badge>
          )}
        />
      )}

      {section === "corporateActions" && (
        <RecordEditor
          title="Corporate actions"
          subtitle="SPLIT / BONUS keep cost base and acquisition date; SPINOFF moves part of the cost base to a new parcel. These rarely come as a statement — enter them from the company's announcement."
          rows={portfolio.corporateActions as unknown as RecordRow[]}
          fields={CA_FIELDS}
          makeBlank={() => blank(CA_FIELDS, { type: "SPLIT" })}
          onChange={onCorporateActions}
          addLabel="Add corporate action"
          rowBadge={(r) => <Badge tone="amber">{r.type || "?"}</Badge>}
        />
      )}

      {section === "income" && (
        <RecordEditor
          title="Income"
          subtitle="DIVIDEND (item 11), TRUST/AMIT (item 13 + capital gains), FOREIGN (item 20). DIVIDEND rows use the payment date for their financial year."
          rows={portfolio.income as unknown as RecordRow[]}
          fields={INCOME_FIELDS}
          makeBlank={() => blank(INCOME_FIELDS, { source_type: "DIVIDEND" })}
          onChange={onIncome}
          addLabel="Add income"
          rowBadge={(r) => (
            <Badge tone={r.source_type === "TRUST" ? "blue" : r.source_type === "FOREIGN" ? "amber" : "green"}>
              {r.source_type || "?"}
            </Badge>
          )}
        />
      )}
    </div>
  );
}
