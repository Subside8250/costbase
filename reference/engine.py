"""
Reference implementation — Australian share portfolio tax engine (v3).

This is the SPECIFICATION BY EXAMPLE for the browser app. Port the logic to
TypeScript and make the golden-master tests in fixtures/expected_results.json
pass. Calculation aid, not tax advice.
"""
from __future__ import annotations
import csv, json, datetime as dt
from dataclasses import dataclass, field
from collections import defaultdict

CGT_DISCOUNT = 0.50


# ---------- dates -----------------------------------------------------------
def D(s: str) -> dt.date:
    return dt.datetime.strptime(s.strip(), "%Y-%m-%d").date()


def fy_end(d: dt.date) -> int:
    """Financial year ENDING year. 1 Jul - 30 Jun."""
    return d.year + 1 if d.month >= 7 else d.year


def fy_label(fy: int) -> str:
    return f"FY{fy-1}-{str(fy)[2:]}"


def add_years(d: dt.date, n: int) -> dt.date:
    try:
        return d.replace(year=d.year + n)
    except ValueError:                    # 29 Feb -> 28 Feb
        return d.replace(year=d.year + n, day=28)


def discount_eligible(open_date: dt.date, sell_date: dt.date) -> bool:
    """ATO: must be held MORE than 12 months. NOT a >=365/366 day count."""
    return sell_date > add_years(open_date, 1)


# ---------- model -----------------------------------------------------------
@dataclass
class Parcel:
    code: str
    open_date: dt.date          # original acquisition date (survives splits)
    quantity: float
    cost_base: float            # AUD, includes brokerage/GST/fees
    origin: str = "BUY"         # BUY | DRP | SPINOFF | BONUS

    @property
    def per_unit(self) -> float:
        return self.cost_base / self.quantity if self.quantity else 0.0


@dataclass
class CGTEvent:
    code: str
    open_date: dt.date
    sell_date: dt.date
    quantity: float
    cost_base: float
    proceeds: float
    fy: int

    @property
    def gain(self) -> float:
        return self.proceeds - self.cost_base

    @property
    def eligible(self) -> bool:
        return discount_eligible(self.open_date, self.sell_date)


class Engine:
    def __init__(self, method: str = "fifo"):
        assert method in ("fifo", "lifo", "minimise_gain")
        self.method = method
        self.parcels: dict[str, list[Parcel]] = defaultdict(list)
        self.cgt: list[CGTEvent] = []
        self.income: list[dict] = []
        self.warnings: list[str] = []

    # -- ingest --------------------------------------------------------------
    def load(self, txn_csv, ca_csv, income_csv):
        rows = []
        for r in csv.DictReader(open(txn_csv, encoding="utf-8-sig")):
            rows.append(("TXN", D(r["date"]), r))
        for r in csv.DictReader(open(ca_csv, encoding="utf-8-sig")):
            rows.append(("CA", D(r["date"]), r))
        # corporate actions apply after same-day trades
        order = {"TXN": 0, "CA": 1}
        for kind, d, r in sorted(rows, key=lambda x: (x[1], order[x[0]])):
            if kind == "TXN":
                self._txn(d, r)
            else:
                self._corporate_action(d, r)
        for r in csv.DictReader(open(income_csv, encoding="utf-8-sig")):
            self.income.append(r)

    def _txn(self, d, r):
        code, act = r["code"].strip(), r["action"].strip().upper()
        qty = float(r["quantity"])
        amt = float(r["consideration_aud"])
        if act in ("BUY", "DRP"):
            self.parcels[code].append(
                Parcel(code, d, qty, amt, "DRP" if act == "DRP" else "BUY"))
        elif act == "SELL":
            self._sell(d, code, qty, amt)
        else:
            self.warnings.append(f"{d} {code}: unknown action {act}")

    def _sell(self, d, code, qty, proceeds):
        ps = self.parcels[code]
        avail = sum(p.quantity for p in ps)
        if qty - avail > 1e-6:
            self.warnings.append(
                f"{d} {code}: sell {qty:g} exceeds holding {avail:g} — check for a "
                f"missing corporate action or DRP allotment")
        ppu = proceeds / qty
        order = self._order(ps, ppu, d)
        left = min(qty, avail)
        for p in order:
            if left <= 1e-9:
                break
            take = min(p.quantity, left)
            frac = take / p.quantity
            cb = p.cost_base * frac
            self.cgt.append(CGTEvent(code, p.open_date, d, take, cb, ppu * take, fy_end(d)))
            p.quantity -= take
            p.cost_base -= cb
            left -= take
        self.parcels[code] = [p for p in ps if p.quantity > 1e-9]

    def _order(self, ps, ppu, sell_date):
        if self.method == "fifo":
            return sorted(ps, key=lambda p: p.open_date)
        if self.method == "lifo":
            return sorted(ps, key=lambda p: p.open_date, reverse=True)

        def assessable(p):                      # POST-discount, not raw gain
            g = ppu - p.per_unit
            if g > 0 and discount_eligible(p.open_date, sell_date):
                g *= (1 - CGT_DISCOUNT)
            return g
        return sorted(ps, key=assessable)

    # -- corporate actions ---------------------------------------------------
    def _corporate_action(self, d, r):
        code, typ = r["code"].strip(), r["type"].strip().upper()
        ps = self.parcels.get(code, [])
        if not ps:
            self.warnings.append(f"{d}: {typ} on {code} but no holding")
            return
        if typ in ("SPLIT", "BONUS"):
            # Cost base spread over the larger number of units.
            # Acquisition date is RETAINED (s130-20 / bonus share rules), so
            # CGT discount eligibility is preserved.
            ratio = float(r["ratio"])
            for p in ps:
                p.quantity *= ratio
        elif typ == "SPINOFF":
            retain = float(r["retain_pct"])
            new_code, new_qty = r["new_code"].strip(), float(r["new_quantity"])
            total_cb = sum(p.cost_base for p in ps)
            spun_cb = total_cb * (1 - retain)
            for p in ps:                        # parent keeps retain_pct
                p.cost_base *= retain
            # New entity: acquisition date = distribution date (confirm demerger
            # roll-over treatment with an accountant for a FOREIGN demerger).
            self.parcels[new_code].append(
                Parcel(new_code, d, new_qty, spun_cb, "SPINOFF"))
        else:
            self.warnings.append(f"{d}: unhandled corporate action {typ}")

    # -- reporting -----------------------------------------------------------
    def holdings(self):
        out = {}
        for code, ps in self.parcels.items():
            q = sum(p.quantity for p in ps)
            if q > 1e-9:
                out[code] = round(q, 4)
        return dict(sorted(out.items()))

    def report(self):
        fys = sorted({fy_end(e.sell_date) for e in self.cgt} |
                     {int(i["fy_end"]) for i in self.income})
        out, carried = [], 0.0
        for fy in fys:
            ev = [e for e in self.cgt if e.fy == fy]
            inc = [i for i in self.income if int(i["fy_end"]) == fy]

            def s(rows, k):
                return round(sum(float(r[k] or 0) for r in rows), 2)

            trusts = [i for i in inc if i["source_type"] == "TRUST"]
            divs = [i for i in inc if i["source_type"] == "DIVIDEND"]
            fgn = [i for i in inc if i["source_type"] == "FOREIGN"]

            # --- capital gains: own disposals + trust-attributed gains -------
            own_disc = sum(e.gain for e in ev if e.gain > 0 and e.eligible)
            own_nond = sum(e.gain for e in ev if e.gain > 0 and not e.eligible)
            own_loss = -sum(e.gain for e in ev if e.gain < 0)
            trust_disc = s(trusts, "cg_discounted_grossed")
            trust_oth = s(trusts, "cg_other")

            disc = own_disc + trust_disc
            nond = own_nond + trust_oth
            avail = own_loss + carried
            carried_in = carried
            nd_after = max(0.0, nond - avail)
            rem = max(0.0, avail - nond)
            d_after = max(0.0, disc - rem)
            net_cg = nd_after + d_after * (1 - CGT_DISCOUNT)
            carried = max(0.0, rem - disc)

            item_20E = s(trusts, "foreign_income") + s(fgn, "foreign_income")
            item_20O = s(trusts, "foreign_tax") + s(fgn, "foreign_tax")

            out.append({
                "fy": fy, "label": fy_label(fy),
                "item_11T_franked_dividends": s(divs, "franked"),
                "item_11S_unfranked_dividends": s(divs, "unfranked"),
                "item_11U_franking_credits": s(divs, "franking_credit"),
                "item_13U_trust_income": s(trusts, "t13U"),
                "item_13C_franked_distributions": s(trusts, "t13C"),
                "item_13Q_trust_franking_credits": s(trusts, "t13Q"),
                "item_18H_total_capital_gains": round(disc + nond, 2),
                "item_18A_net_capital_gain": round(net_cg, 2),
                "capital_loss_carried_in": round(carried_in, 2),
                "capital_loss_carried_forward": round(carried, 2),
                "item_20E_foreign_income": round(item_20E, 2),
                "item_20O_foreign_tax_offset": round(item_20O, 2),
                "item_20F_nz_franking_credit": s(trusts, "nz_franking_credit"),
                "amit_cost_base_increase": s(trusts, "amit_increase"),
                "amit_cost_base_decrease": s(trusts, "amit_decrease"),
                "num_cgt_events": len(ev),
            })
        return out


if __name__ == "__main__":
    import sys, os
    base = os.path.join(os.path.dirname(__file__), "..", "fixtures")
    e = Engine("fifo")
    e.load(os.path.join(base, "transactions.csv"),
           os.path.join(base, "corporate_actions.csv"),
           os.path.join(base, "income.csv"))
    print(json.dumps({"financial_years": e.report(),
                      "holdings_now": e.holdings(),
                      "warnings": e.warnings}, indent=2))
