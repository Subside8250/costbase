/**
 * Generic data-quality caveats surfaced in the UI as reminders. These are
 * general guidance, not tied to any real portfolio. A gap shows against a
 * financial year when one of its `affects` entries contains that FY label
 * (e.g. "FY2024-25"); the generic entries below aren't year-specific, so they
 * act as standing reminders rather than per-year flags.
 */
export interface DataGap {
  id: string;
  description: string;
  affects: string[];
}

export const KNOWN_DATA_GAPS: DataGap[] = [
  {
    id: "DRP_COSTBASE",
    description:
      "DRP (dividend/distribution reinvestment) allotments need a per-unit price to set the parcel's cost base. If your registry statement didn't publish one, the cost base is an estimate — confirm it before relying on it for a future sale.",
    affects: ["future CGT"],
  },
  {
    id: "FOREIGN_GROSS",
    description:
      "Foreign income (20E) must be the GROSS amount, with its withholding tax at 20O. A broker cash ledger often shows only the net amount received — use the broker's foreign-income tax statement for the gross figure and withholding.",
    affects: ["item 20 foreign income"],
  },
  {
    id: "CORPORATE_ACTIONS",
    description:
      "Splits, bonus issues and spin-offs usually aren't in a statement you can import — enter them from the company's announcement, and confirm any demerger roll-over and the resulting cost-base split with a registered tax agent.",
    affects: ["cost base", "future CGT"],
  },
];
