import { Badge } from "./ui";

export function WarningsPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span aria-hidden>✓</span>
        No reconciliation or import warnings.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <span aria-hidden>⚠</span>
        Warnings
        <Badge tone="amber">{warnings.length}</Badge>
      </div>
      <ul className="space-y-1 text-sm text-amber-900">
        {warnings.map((w, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-amber-500">
              •
            </span>
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
