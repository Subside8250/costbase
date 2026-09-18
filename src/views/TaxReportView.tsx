import { useState } from "react";
import {
  dividendSummary,
  trustCapitalGain,
  trustSummary,
  type DividendLine,
  type FyBreakdown,
  type Portfolio,
  type TrustLine,
} from "../portfolio";
import type { FinancialYearReport } from "../engine";
import { Badge, Card, Empty, Td, Th } from "../components/ui";
import { money, signedMoney } from "../format";
import { KNOWN_DATA_GAPS } from "../data/knownDataGaps";

const EMPTY_BREAKDOWN: FyBreakdown = { fy: 0, dividends: [], trusts: [], foreignDirect: [], disposals: [] };

export function TaxReportView({ portfolio }: { portfolio: Portfolio }) {
  const years = portfolio.report;
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  if (years.length === 0) {
    return <Empty>No tax report yet. Import your statements on the Import tab.</Empty>;
  }
  const current = years.find((y) => y.fy === selected) ?? years[years.length - 1];
  const bd = portfolio.breakdowns[current.fy] ?? EMPTY_BREAKDOWN;
  const gaps = gapsFor(current.label);

  function copyAll() {
    void navigator.clipboard?.writeText(buildCopyText(current, bd)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  }

  const hasForeignDirect = bd.foreignDirect.length > 0;

  return (
    <div className="space-y-6">
      <Card
        title="Capital gains & losses across years"
        subtitle="Every figure in this table is calculated by CostBase from your statement data (CGT netting, the 50% discount and the loss carry-forward chain)."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Financial year</Th>
                <Th align="right">18H total gains</Th>
                <Th align="right">Loss carried in</Th>
                <Th align="right">18A net capital gain</Th>
                <Th align="right">18V carried forward</Th>
                <Th align="right">CGT events</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {years.map((y) => (
                <tr
                  key={y.fy}
                  onClick={() => setSelected(y.fy)}
                  className={`cursor-pointer hover:bg-slate-50 ${y.fy === current.fy ? "bg-blue-50/50" : ""}`}
                >
                  <Td className="font-medium">
                    {y.label} {gapsFor(y.label).length > 0 && <Badge tone="amber">caveat</Badge>}
                  </Td>
                  <Td align="right" mono>{money(y.item_18H_total_capital_gains)}</Td>
                  <Td align="right" mono>{money(y.capital_loss_carried_in)}</Td>
                  <Td align="right" mono className="font-semibold">{money(y.item_18A_net_capital_gain)}</Td>
                  <Td align="right" mono>{money(y.capital_loss_carried_forward)}</Td>
                  <Td align="right" mono>{y.num_cgt_events}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={`myTax entries — ${current.label}`}
        subtitle="Laid out like the myTax screens. The Income / Credit line matches the prefill summary; the fields under it are what you type into each record."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyAll}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {copied ? "Copied ✓" : "Copy all"}
            </button>
            {years.map((y) => (
              <button
                key={y.fy}
                onClick={() => setSelected(y.fy)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  y.fy === current.fy ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {y.label.replace("FY", "")}
              </button>
            ))}
          </div>
        }
      >
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Values with a{" "}
          <span className="underline decoration-dotted decoration-amber-500 underline-offset-2">dotted underline</span>
          <sup className="text-[9px] font-semibold text-amber-600">calc</sup> are calculated or derived by CostBase
          (sums, the CGT netting/discount, the discounted-vs-other split, 20M). Everything else is read directly from
          your statements.
        </p>
        <div className="space-y-6">
          <Section title="Dividends">
            {bd.dividends.length === 0 ? (
              <Empty>No dividends this year.</Empty>
            ) : (
              bd.dividends.map((d) => <DividendCard key={d.code} d={d} />)
            )}
          </Section>

          <Section title="Managed fund and trust distributions">
            {bd.trusts.length === 0 ? (
              <Empty>No managed fund distributions this year.</Empty>
            ) : (
              bd.trusts.map((t) => <TrustCard key={t.code} t={t} />)
            )}
          </Section>

          <Section title="Capital gains or losses">
            <div className="rounded-lg border border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Code>18G</Code>
                <span className="text-slate-600">Did you have a capital gains tax event during the year?</span>
                <span
                  className="font-semibold text-slate-800 underline decoration-dotted decoration-amber-500 underline-offset-2"
                  title="Calculated or derived by CostBase — not read directly from a statement"
                >
                  {current.num_cgt_events > 0 || current.item_18H_total_capital_gains > 0 ? "Yes" : "No"}
                </span>
                <sup className="text-[9px] font-semibold text-amber-600">calc</sup>
              </div>
              {bd.disposals.length > 0 ? (
                <div className="mb-3 overflow-x-auto">
                  <div className="mb-1 text-xs font-medium text-slate-500">Your own disposals (shares you sold)</div>
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <Th>Asset</Th>
                        <Th align="right">Proceeds</Th>
                        <Th align="right">Cost base</Th>
                        <Th align="right">Gain / loss</Th>
                        <Th>Discount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bd.disposals.map((d) => (
                        <tr key={d.code}>
                          <Td className="font-medium">{d.code}</Td>
                          <Td align="right" mono>{money(d.proceeds)}</Td>
                          <Td align="right" mono><CalcValue value={money(d.costBase)} calc /></Td>
                          <Td align="right" mono><CalcValue value={signedMoney(d.gain)} calc /></Td>
                          <Td>{d.mixedEligibility ? "part" : d.eligible ? "50%" : "no"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mb-3 text-xs text-slate-400">No disposals of your own this year.</p>
              )}
              <p className="mb-3 text-xs text-slate-400">
                Managed fund capital gains are entered inside each fund's record above and flow into
                these totals — don't enter them again here.
              </p>
              <div className="rounded-lg bg-slate-50 p-3">
                <FieldRow code="18H" label="Total current year capital gains" value={money(current.item_18H_total_capital_gains)} calc />
                <FieldRow code="18A" label="Net capital gain" value={money(current.item_18A_net_capital_gain)} bold calc />
                <FieldRow code="18V" label="Net capital losses carried forward" value={money(current.capital_loss_carried_forward)} calc />
              </div>
            </div>
          </Section>

          {hasForeignDirect && (
            <Section title="Foreign income (direct — not via a fund)">
              {bd.foreignDirect.map((f) => (
                <div key={f.code} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">{f.code}</div>
                  <FieldRow code="20E" label="Assessable foreign source income" value={money(f.foreign_income)} />
                  <FieldRow code="20O" label="Foreign income tax offset" value={money(f.foreign_tax)} />
                </div>
              ))}
            </Section>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
              <span aria-hidden>⚠</span> Known data gaps affecting {current.label} — figures may be incomplete
            </h3>
            <ul className="space-y-2 text-sm text-amber-900">
              {gaps.map((g) => (
                <li key={g.id}>
                  <span className="font-mono text-xs font-semibold">{g.id}</span> — {g.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-12 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-white">
      {children}
    </span>
  );
}

/** Renders a money value; when `calc` is set it's marked as calculated/derived
 * (amber dotted underline + a "calc" tag) rather than read from a statement. */
function CalcValue({ value, calc, bold }: { value: string; calc?: boolean; bold?: boolean }) {
  const cls = `tnum ${bold ? "font-semibold text-slate-800" : "text-slate-700"}`;
  if (!calc) return <span className={cls}>{value}</span>;
  return (
    <span className={cls}>
      <span
        className="underline decoration-dotted decoration-amber-500 underline-offset-2"
        title="Calculated or derived by CostBase — not read directly from a statement"
      >
        {value}
      </span>
      <sup className="ml-0.5 text-[9px] font-semibold text-amber-600">calc</sup>
    </span>
  );
}

function FieldRow({
  code,
  label,
  value,
  bold,
  calc,
}: {
  code?: string;
  label: string;
  value: string;
  bold?: boolean;
  calc?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-sm">
      {code ? <Code>{code}</Code> : <span className="w-12 shrink-0" />}
      <span className="flex-1 text-slate-600">{label}</span>
      <CalcValue value={value} calc={calc} bold={bold} />
    </div>
  );
}

function SummaryHeader({
  name,
  income,
  credit,
  incomeCalc,
  creditCalc,
}: {
  name: string;
  income: number;
  credit: number;
  incomeCalc?: boolean;
  creditCalc?: boolean;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
      <span className="text-sm font-semibold text-slate-800">{name}</span>
      <span className="flex gap-4 text-xs">
        <span className="text-slate-500">Income <CalcValue value={money(income)} calc={incomeCalc} bold /></span>
        <span className="text-slate-500">Credit/Tax withheld <CalcValue value={money(credit)} calc={creditCalc} bold /></span>
      </span>
    </div>
  );
}

function DividendCard({ d }: { d: DividendLine }) {
  const s = dividendSummary(d);
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <SummaryHeader name={d.code} income={s.income} credit={s.credit} incomeCalc />
      <FieldRow code="11S" label="Unfranked amount" value={money(d.unfranked)} />
      <FieldRow code="11T" label="Franked amount" value={money(d.franked)} />
      <FieldRow code="11U" label="Franking credit" value={money(d.franking_credit)} />
    </div>
  );
}

function TrustCard({ t }: { t: TrustLine }) {
  const s = trustSummary(t);
  const cg = trustCapitalGain(t);
  const hasCg = t.cg_discounted_grossed !== 0 || t.cg_other !== 0;
  const hasForeign = t.foreign_income !== 0 || t.foreign_tax !== 0 || t.nz_franking_credit !== 0;
  const hasAmit = t.amit_increase !== 0 || t.amit_decrease !== 0;
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <SummaryHeader name={t.code} income={s.income} credit={s.credit} incomeCalc creditCalc />
      <FieldGroup label="Item 13 — Trust income">
        <FieldRow code="13U" label="Trust income (non-primary production)" value={money(t.t13U)} />
        <FieldRow code="13C" label="Franked distributions from trusts" value={money(t.t13C)} />
        <FieldRow code="13Q" label="Share of franking credit" value={money(t.t13Q)} />
      </FieldGroup>
      {hasCg && (
        <FieldGroup label="Item 18 — Capital gains (from this fund)">
          <FieldRow label="Capital gains — discounted method (grossed-up)" value={money(t.cg_discounted_grossed)} calc />
          <FieldRow label="Capital gains — other method" value={money(t.cg_other)} calc />
          <FieldRow code="18H" label="Total current year capital gains" value={money(cg.total)} calc />
          <FieldRow code="18A" label="Net capital gain" value={money(cg.net)} calc />
        </FieldGroup>
      )}
      {hasForeign && (
        <FieldGroup label="Item 20 — Foreign income">
          <FieldRow code="20E" label="Assessable foreign source income" value={money(t.foreign_income)} />
          <FieldRow code="20M" label="Other net foreign source income (usually = 20E; confirm)" value={money(t.foreign_income)} calc />
          <FieldRow code="20O" label="Foreign income tax offset" value={money(t.foreign_tax)} />
          <FieldRow code="20F" label="NZ franking credit" value={money(t.nz_franking_credit)} />
        </FieldGroup>
      )}
      {hasAmit && (
        <p className="mt-2 text-xs text-slate-400">
          AMIT cost-base adjustment (not entered as income; adjusts future CGT): increase{" "}
          {money(t.amit_increase)}, decrease {money(t.amit_decrease)}.
        </p>
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function buildCopyText(r: FinancialYearReport, bd: FyBreakdown): string {
  const L: string[] = [`CostBase — myTax entries — ${r.label}`, ""];
  if (bd.dividends.length) {
    L.push("DIVIDENDS");
    for (const d of bd.dividends) {
      const s = dividendSummary(d);
      L.push(`  ${d.code}  [Income ${money(s.income)} · Credit ${money(s.credit)}]`);
      L.push(`    11S Unfranked: ${money(d.unfranked)}`);
      L.push(`    11T Franked: ${money(d.franked)}`);
      L.push(`    11U Franking credit: ${money(d.franking_credit)}`);
    }
    L.push("");
  }
  if (bd.trusts.length) {
    L.push("MANAGED FUND AND TRUST DISTRIBUTIONS");
    for (const t of bd.trusts) {
      const s = trustSummary(t);
      const cg = trustCapitalGain(t);
      L.push(`  ${t.code}  [Income ${money(s.income)} · Credit ${money(s.credit)}]`);
      L.push(`    13U Trust income: ${money(t.t13U)}`);
      L.push(`    13C Franked distributions: ${money(t.t13C)}`);
      L.push(`    13Q Franking credit: ${money(t.t13Q)}`);
      if (t.cg_discounted_grossed || t.cg_other) {
        L.push(`    18 Capital gains discounted (grossed-up): ${money(t.cg_discounted_grossed)}`);
        L.push(`    18 Capital gains other method: ${money(t.cg_other)}`);
        L.push(`    18H Total current year capital gains: ${money(cg.total)}`);
        L.push(`    18A Net capital gain: ${money(cg.net)}`);
      }
      if (t.foreign_income || t.foreign_tax || t.nz_franking_credit) {
        L.push(`    20E Assessable foreign source income: ${money(t.foreign_income)}`);
        L.push(`    20O Foreign income tax offset: ${money(t.foreign_tax)}`);
        if (t.nz_franking_credit) L.push(`    20F NZ franking credit: ${money(t.nz_franking_credit)}`);
      }
    }
    L.push("");
  }
  L.push("CAPITAL GAINS OR LOSSES");
  for (const d of bd.disposals) {
    L.push(`  ${d.code} disposal: proceeds ${money(d.proceeds)}, cost ${money(d.costBase)}, gain/loss ${signedMoney(d.gain)}`);
  }
  L.push(`  18H Total current year capital gains: ${money(r.item_18H_total_capital_gains)}`);
  L.push(`  18A Net capital gain: ${money(r.item_18A_net_capital_gain)}`);
  L.push(`  18V Net capital losses carried forward: ${money(r.capital_loss_carried_forward)}`);
  if (bd.foreignDirect.length) {
    L.push("", "FOREIGN INCOME (DIRECT)");
    for (const f of bd.foreignDirect) {
      L.push(`  ${f.code}: 20E ${money(f.foreign_income)}, 20O ${money(f.foreign_tax)}`);
    }
  }
  L.push("", "Calculation aid, not tax advice — verify against your statements.");
  return L.join("\n");
}

function gapsFor(label: string) {
  return KNOWN_DATA_GAPS.filter((g) => g.affects.some((a) => a.includes(label)));
}
