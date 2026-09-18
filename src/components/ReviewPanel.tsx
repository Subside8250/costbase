import { useState } from "react";
import type { ExtractedItem, ParsedTarget } from "../parsers";
import { Badge, Card } from "./ui";

export interface PendingItem extends ExtractedItem {
  include: boolean;
  docLabel: string;
  fileName: string;
}

const TARGET_LABEL: Record<ParsedTarget, string> = {
  transactions: "Transactions",
  income: "Income",
  corporateActions: "Corporate actions",
  brokerHoldings: "Broker holdings",
};

const TARGET_TONE: Record<ParsedTarget, "green" | "blue" | "amber" | "slate"> = {
  transactions: "green",
  income: "blue",
  corporateActions: "amber",
  brokerHoldings: "slate",
};

interface Props {
  pending: PendingItem[];
  notes: string[];
  onToggle: (id: string) => void;
  onEdit: (id: string, key: string, value: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}

/** Review-and-confirm table: nothing here reaches the tax engine until the
 * user clicks Apply. Every extracted figure is editable first. */
export function ReviewPanel({ pending, notes, onToggle, onEdit, onApply, onDiscard }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (pending.length === 0) return null;
  const selected = pending.filter((p) => p.include).length;

  const groups = groupByTarget(pending);

  return (
    <Card
      title="Review extracted data"
      subtitle="Parsed from your statements. Check the figures, edit anything that looks off, then apply. Nothing is added to your tax report until you do."
      right={
        <div className="flex gap-2">
          <button
            onClick={onApply}
            disabled={selected === 0}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Apply {selected} item{selected === 1 ? "" : "s"}
          </button>
          <button
            onClick={onDiscard}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Discard
          </button>
        </div>
      }
    >
      {notes.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>⚠</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-5">
        {groups.map(([target, items]) => (
          <div key={target}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Badge tone={TARGET_TONE[target]}>{TARGET_LABEL[target]}</Badge>
              <span>{items.length}</span>
            </h3>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.include}
                      onChange={() => onToggle(item.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex-1 text-sm text-slate-700">{item.summary}</span>
                    {item.flag && <Badge tone="amber">{item.flag}</Badge>}
                    <span className="text-xs text-slate-400">{item.docLabel}</span>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {expanded[item.id] ? "Hide" : "Edit"}
                    </button>
                  </div>
                  {expanded[item.id] && (
                    <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-3 lg:grid-cols-4">
                      {Object.entries(item.row)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => (
                          <label key={k} className="block">
                            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              {k}
                            </span>
                            <input
                              value={v}
                              onChange={(e) => onEdit(item.id, k, e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
                            />
                          </label>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function groupByTarget(pending: PendingItem[]): Array<[ParsedTarget, PendingItem[]]> {
  const order: ParsedTarget[] = ["transactions", "income", "corporateActions", "brokerHoldings"];
  return order
    .map((t) => [t, pending.filter((p) => p.target === t)] as [ParsedTarget, PendingItem[]])
    .filter(([, items]) => items.length > 0);
}
