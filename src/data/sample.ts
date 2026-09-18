/**
 * Small synthetic demo dataset for the "Load sample data" button — fictional
 * holdings, not anyone's real portfolio. It exercises the main features: a
 * discount-eligible gain, a franked dividend, a trust/AMIT distribution
 * (items 13/18/20), a DRP allotment, an AMIT cost-base adjustment, and a
 * holdings-reconciliation shortfall. Real data is imported by the user and
 * kept only in their browser.
 */
export const SAMPLE = {
  transactionsCsv: [
    "date,action,market,code,quantity,consideration_aud,currency,fx_note,source,notes",
    "2022-02-01,BUY,ASX,SMPLX,100,2000.00,AUD,,Sample data,",
    "2022-07-01,BUY,ASX,SMPLETF,50,5000.00,AUD,,Sample data,",
    "2023-11-20,DRP,ASX,SMPLETF,1,105.00,AUD,,Sample data,DRP allotment",
    "2024-03-01,SELL,ASX,SMPLX,100,2600.00,AUD,,Sample data,sold at a gain; held over 12 months",
    "",
  ].join("\n"),

  corporateActionsCsv: [
    "date,code,type,ratio,new_code,new_quantity,retain_pct,source,notes",
    "",
  ].join("\n"),

  incomeCsv: [
    "fy_end,source_type,code,pay_date,franked,unfranked,franking_credit,t13U,t13C,t13Q,cg_discounted_grossed,cg_other,foreign_income,foreign_tax,nz_franking_credit,amit_increase,amit_decrease,source,notes",
    "2024,DIVIDEND,SMPLBANK,2023-11-15,700.00,0.00,300.00,,,,,,,,,,,Sample data,",
    "2024,TRUST,SMPLETF,,,,,120.00,80.00,34.00,200.00,0.00,150.00,20.00,0.00,10.00,0.00,Sample data,",
    "",
  ].join("\n"),
};

/** Broker unit counts for the reconciliation demo. The engine holds 51 SMPLETF
 * (50 bought + 1 DRP); the broker shows 52, so the app flags a 1-unit shortfall. */
export const SAMPLE_BROKER_UNITS: Record<string, number> = {
  SMPLETF: 52,
};
