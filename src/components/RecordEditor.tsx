import { useState, type ReactNode } from "react";
import { Badge, Card, Empty, Td, Th } from "./ui";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "select";
  options?: string[];
  /** Shown as a column in the table (all fields appear in the edit form). */
  primary?: boolean;
  placeholder?: string;
}

export type RecordRow = Record<string, string>;

interface Props {
  title: string;
  subtitle?: string;
  rows: RecordRow[];
  fields: FieldDef[];
  makeBlank: () => RecordRow;
  onChange: (rows: RecordRow[]) => void;
  /** Optional badge/summary cell at the start of each table row. */
  rowBadge?: (row: RecordRow) => ReactNode;
  addLabel?: string;
}

const ASSUMPTION_HINT =
  "Leave a note in 'source' or 'notes' (e.g. \"assumption\") for any figure you've estimated rather than taken from a statement.";

/** Generic add/edit/delete table for a CSV-backed record type. Changes are
 * explicit (Save), and estimated values can be flagged in the notes/source
 * fields so assumptions stay visible in the report caveats. */
export function RecordEditor({
  title,
  subtitle,
  rows,
  fields,
  makeBlank,
  onChange,
  rowBadge,
  addLabel = "Add row",
}: Props) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<RecordRow>({});
  const primary = fields.filter((f) => f.primary);

  function startNew() {
    setDraft(makeBlank());
    setEditing("new");
  }
  function startEdit(i: number) {
    setDraft({ ...rows[i] });
    setEditing(i);
  }
  function save() {
    if (editing === "new") onChange([...rows, draft]);
    else if (typeof editing === "number") {
      const next = rows.slice();
      next[editing] = draft;
      onChange(next);
    }
    setEditing(null);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  const isAssumption = (r: RecordRow) =>
    /assum|estimat/i.test(`${r.source ?? ""} ${r.notes ?? ""}`);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      right={
        <button
          onClick={startNew}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          + {addLabel}
        </button>
      }
    >
      {editing !== null && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            {editing === "new" ? addLabel : "Edit row"}
          </h3>
          <p className="mb-3 text-xs text-slate-500">{ASSUMPTION_HINT}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                {f.type === "select" ? (
                  <select
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    value={draft[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>No rows yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {rowBadge && <Th></Th>}
                {primary.map((f) => (
                  <Th key={f.key}>{f.label}</Th>
                ))}
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {rowBadge && <Td>{rowBadge(r)}</Td>}
                  {primary.map((f) => (
                    <Td key={f.key} className={f.key === "code" ? "font-medium" : undefined}>
                      {r[f.key] || "—"}
                      {f.key === primary[primary.length - 1].key && isAssumption(r) && (
                        <span className="ml-2">
                          <Badge tone="amber">assumption</Badge>
                        </span>
                      )}
                    </Td>
                  ))}
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(i)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(i)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
