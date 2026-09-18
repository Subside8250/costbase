import { Fragment, useState } from "react";
import type { Portfolio } from "../portfolio";
import { Badge, Card, Empty, Td, Th } from "../components/ui";
import { isoDate, money, units } from "../format";

export function HoldingsView({ portfolio }: { portfolio: Portfolio }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (portfolio.holdings.length === 0) {
    return <Empty>No open holdings. Import transactions to get started.</Empty>;
  }
  const totalCost = portfolio.holdings.reduce((s, h) => s + h.costBase, 0);

  return (
    <Card
      title="Open holdings"
      subtitle="Cost base is what you paid (net of brokerage/GST/fees). Expand a row for individual parcels and CGT-discount status."
      right={<span className="text-xs text-slate-500">Total cost base {money(totalCost)}</span>}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <Th></Th>
              <Th>Code</Th>
              <Th align="right">Units</Th>
              <Th align="right">Cost base</Th>
              <Th align="right">Cost / unit</Th>
              <Th align="right">Parcels</Th>
              <Th align="right">AMIT net adj</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {portfolio.holdings.map((h) => {
              const isOpen = open[h.code];
              return (
                <Fragment key={h.code}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setOpen((o) => ({ ...o, [h.code]: !o[h.code] }))}
                  >
                    <Td className="text-slate-400">{isOpen ? "▾" : "▸"}</Td>
                    <Td className="font-medium">{h.code}</Td>
                    <Td align="right" mono>
                      {units(h.units)}
                    </Td>
                    <Td align="right" mono>
                      {money(h.costBase)}
                    </Td>
                    <Td align="right" mono>
                      {money(h.perUnit)}
                    </Td>
                    <Td align="right" mono>
                      {h.parcels.length}
                    </Td>
                    <Td align="right" mono>
                      {h.amitNet === 0 ? "—" : money(h.amitNet)}
                    </Td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50/60 px-3 py-3">
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              <Th>Acquired</Th>
                              <Th align="right">Units</Th>
                              <Th align="right">Cost base</Th>
                              <Th align="right">Cost / unit</Th>
                              <Th>Origin</Th>
                              <Th>If sold today</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {h.parcels.map((p, i) => (
                              <tr key={i}>
                                <Td mono>{isoDate(p.openDate)}</Td>
                                <Td align="right" mono>
                                  {units(p.quantity)}
                                </Td>
                                <Td align="right" mono>
                                  {money(p.costBase)}
                                </Td>
                                <Td align="right" mono>
                                  {money(p.perUnit)}
                                </Td>
                                <Td>
                                  <Badge tone={p.origin === "BUY" ? "slate" : "blue"}>
                                    {p.origin}
                                  </Badge>
                                </Td>
                                <Td>
                                  {p.discountIfSoldToday ? (
                                    <Badge tone="green">50% discount</Badge>
                                  ) : (
                                    <Badge tone="amber">No discount yet</Badge>
                                  )}
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {h.amitNet !== 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Net AMIT cost-base adjustment of {money(h.amitNet)} is reported for{" "}
                            {h.code} and tracked for future CGT. It is not applied to the parcel
                            cost base above.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
