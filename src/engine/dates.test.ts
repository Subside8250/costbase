import { describe, expect, it } from "vitest";
import { addYears, D, discountEligible, fyEnd, fyLabel } from "./dates";

describe("financial year mapping", () => {
  it("maps months to the FY ending year (1 Jul – 30 Jun)", () => {
    expect(fyEnd(D("2025-06-30"))).toBe(2025);
    expect(fyEnd(D("2025-07-01"))).toBe(2026);
    expect(fyEnd(D("2026-07-02"))).toBe(2027);
    expect(fyLabel(2026)).toBe("FY2025-26");
  });
});

describe("addYears maps 29 Feb → 28 Feb in non-leap target years", () => {
  it("2024-02-29 + 1yr → 2025-02-28", () => {
    expect(addYears(D("2024-02-29"), 1).toISOString().slice(0, 10)).toBe("2025-02-28");
  });
  it("2020-02-29 + 4yr → 2024-02-29 (leap → leap)", () => {
    expect(addYears(D("2020-02-29"), 4).toISOString().slice(0, 10)).toBe("2024-02-29");
  });
});

describe("Test 1 — CGT discount boundary is the CALENDAR rule, not a day count", () => {
  it("buy 2023-07-02 → sell 2024-07-02 is NOT eligible (exactly 12 months, spans leap day)", () => {
    expect(discountEligible(D("2023-07-02"), D("2024-07-02"))).toBe(false);
  });
  it("buy 2023-07-02 → sell 2024-07-03 IS eligible (one day past 12 months)", () => {
    expect(discountEligible(D("2023-07-02"), D("2024-07-03"))).toBe(true);
  });
  it("buy 2022-07-02 → sell 2023-07-02 is NOT eligible (exactly 12 months)", () => {
    expect(discountEligible(D("2022-07-02"), D("2023-07-02"))).toBe(false);
  });
  it("buy 2022-07-02 → sell 2023-07-03 IS eligible", () => {
    expect(discountEligible(D("2022-07-02"), D("2023-07-03"))).toBe(true);
  });
});
