/**
 * Invariant test: every KPI consumer in the CRM must agree on the same
 * Total Revenue / Total COGS / Gross Profit / Net Profit / Operating Cost /
 * Outstanding / Collection Rate. If any of these drift between
 *
 *   - getFinancialKpis()                (server/financialKpis.ts)
 *   - getDashboardKpisV2()              (Dashboard hero & KPI strip)
 *   - getNetProfitFeed()                (Dashboard Net Profit card)
 *   - getDashboardByPeriod()            (period-aware P&L)
 *   - getQuickStats()                   (Receivables / Quick Stats)
 *
 * the test fails. Skipped automatically when DATABASE_URL is missing.
 */
import { describe, it, expect } from "vitest";
import { getFinancialKpis } from "./financialKpis";
import {
  getDashboardKpisV2,
  getNetProfitFeed,
  getDashboardByPeriod,
  getQuickStats,
} from "./db";

const SHOULD_RUN = !!process.env.DATABASE_URL;
const round2 = (n: number) => Math.round(n * 100) / 100;

describe.skipIf(!SHOULD_RUN)("KPI consistency \u2014 single source of truth", () => {
  it("all consumers report the same Total Revenue / COGS / GP / Net / OpCost / Outstanding", async () => {
    const k = await getFinancialKpis();
    const kpisV2 = await getDashboardKpisV2();
    const netFeed = await getNetProfitFeed();
    const period = await getDashboardByPeriod();
    const quick = await getQuickStats();

    // Total Revenue
    expect(round2(kpisV2.totalRevenue)).toBe(round2(k.totalRevenue));
    expect(round2(netFeed.totalRevenue)).toBe(round2(k.totalRevenue));
    expect(round2(period.totalRevenue)).toBe(round2(k.totalRevenue));
    expect(round2(quick.totalRevenue)).toBe(round2(k.totalRevenue));

    // Total COGS
    expect(round2(kpisV2.totalCogs)).toBe(round2(k.totalCogs));
    expect(round2(period.totalCogs)).toBe(round2(k.totalCogs));

    // Gross Profit
    expect(round2(kpisV2.grossProfit)).toBe(round2(k.grossProfit));
    expect(round2(netFeed.grossProfit)).toBe(round2(k.grossProfit));
    expect(round2(period.grossProfit)).toBe(round2(k.grossProfit));

    // Operating Cost
    expect(round2(netFeed.operatingCost)).toBe(round2(k.operatingCost));
    expect(round2(period.operatingCost)).toBe(round2(k.operatingCost));

    // Net Profit
    expect(round2(netFeed.netProfit)).toBe(round2(k.netProfit));
    expect(round2(period.netProfit)).toBe(round2(k.netProfit));

    // Outstanding
    expect(round2(kpisV2.outstanding)).toBe(round2(k.outstanding));
    expect(round2(period.outstanding)).toBe(round2(k.outstanding));
    expect(round2(quick.totalOutstanding)).toBe(round2(k.outstanding));

    // Collection Rate
    expect(quick.collectionRate).toBe(k.collectionRate);
  });

  it("identities hold: GP = Rev \u2212 COGS, NetProfit = GP \u2212 OpCost, Collected + Outstanding = Rev", async () => {
    const k = await getFinancialKpis();
    expect(round2(k.grossProfit)).toBe(round2(k.totalRevenue - k.totalCogs));
    expect(round2(k.netProfit)).toBe(round2(k.grossProfit - k.operatingCost));
    expect(round2(k.collected + k.outstanding)).toBe(round2(k.totalRevenue));
  });

  it("year-scoped totals reconcile to the all-time totals", async () => {
    const all = await getFinancialKpis();
    if (all.availableYears.length === 0) return;
    let revSum = 0,
      cogsSum = 0;
    for (const y of all.availableYears) {
      const yk = await getFinancialKpis({ year: y });
      revSum += yk.totalRevenue;
      cogsSum += yk.totalCogs;
    }
    expect(round2(revSum)).toBe(round2(all.totalRevenue));
    expect(round2(cogsSum)).toBe(round2(all.totalCogs));
  });
});
