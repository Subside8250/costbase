import { describe, expect, it } from "vitest";
import { detectCsvType } from "./detectCsv";

const TXN = "date,action,market,code,quantity,consideration_aud,currency,fx_note,source,notes";
const CA = "date,code,type,ratio,new_code,new_quantity,retain_pct,source,notes";
const INCOME =
  "fy_end,source_type,code,pay_date,franked,unfranked,franking_credit,t13U,t13C,t13Q,cg_discounted_grossed,cg_other,foreign_income,foreign_tax,nz_franking_credit,amit_increase,amit_decrease,source,notes";

describe("detectCsvType — one upload area classifies each CSV by its header", () => {
  it("classifies each canonical CSV by its header row", () => {
    expect(detectCsvType(TXN + "\n")).toBe("transactions");
    expect(detectCsvType(CA + "\n")).toBe("corporateActions");
    expect(detectCsvType(INCOME + "\n")).toBe("income");
  });

  it("tolerates a BOM, whitespace and mixed case in the header", () => {
    expect(detectCsvType("﻿ Date , Action , Code , Consideration_AUD \n")).toBe(
      "transactions",
    );
  });

  it("returns null for an unrecognised CSV", () => {
    expect(detectCsvType("foo,bar,baz\n1,2,3\n")).toBeNull();
    expect(detectCsvType("")).toBeNull();
  });
});
