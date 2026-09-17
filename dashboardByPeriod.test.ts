import { describe, it, expect } from "vitest";
import { getDashboardByPeriod } from "./db";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("getDashboardByPeriod", () => {
  it("all-time: Gross Profit = Revenue − COGS, Net Profit = GP − Operating Cost", async () => {
    const k = await getDashboardByPeriod();
    expect(round2(k.grossProfit)).toBeCloseTo(round2(k.totalRevenue - k.totalCogs), 2);
    expect(round2(k.netProfit)).toBeCloseTo(round2(k.grossProfit - k.operatingCost), 2);
    expect(k.totalCogs).toBeGreaterThan(0);
    // After the proportional-COGS bug fix, COGS must be plausibly < revenue,
    // not 5x revenue as before. We assert COGS ratio is < 80% which leaves
    // gross margin > 20% (real value is ~60%).
    if (k.totalRevenue > 0) {
      expect(k.totalCogs / k.totalRevenue).toBeLessThan(0.8);
    }
    expect(k.availableYears.length).toBeGreaterThan(0);
  });

  it("period totals reconcile: sum across all years equals all-time totals", async () => {
    const all = await getDashboardByPeriod();
    let revSum = 0,
      cogsSum = 0,
      opSum = 0;
    for (const y of all.availableYears) {
      const yk = await getDashboardByPeriod({ year: y });
      revSum += yk.totalRevenue;
      cogsSum += yk.totalCogs;
      opSum += yk.operatingCost;
    }
    expect(round2(revSum)).toBeCloseTo(round2(all.totalRevenue), 2);
    expect(round2(cogsSum)).toBeCloseTo(round2(all.totalCogs), 2);
    expect(round2(opSum)).toBeCloseTo(round2(all.operatingCost), 2);
  });

  it("month-level filter: 12 months sum to year total for the most recent year", async () => {
    const all = await getDashboardByPeriod();
    const year = all.availableYears[all.availableYears.length - 1]!;
    const yk = await getDashboardByPeriod({ year });
    let mRev = 0,
      mCogs = 0,
      mOp = 0;
    for (let m = 1; m <= 12; m++) {
      const mk = await getDashboardByPeriod({ year, month: m });
      mRev += mk.totalRevenue;
      mCogs += mk.totalCogs;
      mOp += mk.operatingCost;
    }
    expect(round2(mRev)).toBeCloseTo(round2(yk.totalRevenue), 2);
    expect(round2(mCogs)).toBeCloseTo(round2(yk.totalCogs), 2);
    expect(round2(mOp)).toBeCloseTo(round2(yk.operatingCost), 2);
  });

  it("Outstanding is point-in-time: same value for any period", async () => {
    const all = await getDashboardByPeriod();
    const year = all.availableYears[0]!;
    const yk = await getDashboardByPeriod({ year });
    const mk = await getDashboardByPeriod({ year, month: 1 });
    expect(round2(yk.outstanding)).toBeCloseTo(round2(all.outstanding), 2);
    expect(round2(mk.outstanding)).toBeCloseTo(round2(all.outstanding), 2);
  });

  it("Margins reflect formula", async () => {
    const k = await getDashboardByPeriod();
    if (k.totalRevenue > 0) {
      const expectedGm = Number(((k.grossProfit / k.totalRevenue) * 100).toFixed(1));
      expect(k.grossMargin).toBeCloseTo(expectedGm, 1);
      const expectedNm = Number(((k.netProfit / k.totalRevenue) * 100).toFixed(1));
      expect(k.netMargin).toBeCloseTo(expectedNm, 1);
    }
  });
});
