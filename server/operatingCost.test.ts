import { describe, it, expect } from "vitest";
import {
  getOperatingCostSummary,
  listOperatingCostRows,
  getNetProfitFeed,
} from "./db";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("Operating Cost classification & math", () => {
  it("operating bucket excludes any inventory or shipping rows", async () => {
    const summary = await getOperatingCostSummary();
    expect(summary.totalOperating).toBeGreaterThan(0);

    // No category in the operating breakdown should be 'inventory_purchase' or 'shipping'
    for (const c of summary.byCategory) {
      expect(c.category).not.toBe("inventory_purchase");
      expect(c.category).not.toBe("shipping");
    }

    // Drilldown rows should all be tagged classification === 'operating'
    const rows = await listOperatingCostRows({ limit: 1000 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.classification).toBe("operating");
    }
  });

  it("byCategory totals reconcile to totalOperating (1 cent tolerance)", async () => {
    const summary = await getOperatingCostSummary();
    const sumOfCats = summary.byCategory.reduce((s, c) => s + c.total, 0);
    expect(round2(sumOfCats)).toBeCloseTo(round2(summary.totalOperating), 2);
  });

  it("byMonth totals reconcile to totalOperating (1 cent tolerance)", async () => {
    const summary = await getOperatingCostSummary();
    const sumOfMonths = summary.byMonth.reduce((s, m) => s + m.total, 0);
    expect(round2(sumOfMonths)).toBeCloseTo(round2(summary.totalOperating), 2);
  });

  it("byCategoryByMonth pivot reconciles to per-category totals", async () => {
    const summary = await getOperatingCostSummary();
    for (const c of summary.byCategory) {
      const monthMap = summary.byCategoryByMonth[c.category] ?? {};
      const monthSum = Object.values(monthMap).reduce((s, v) => s + v, 0);
      expect(round2(monthSum)).toBeCloseTo(round2(c.total), 2);
    }
  });

  it("Net Profit feed = Gross Profit − Operating Cost", async () => {
    const feed = await getNetProfitFeed();
    expect(round2(feed.netProfit)).toBeCloseTo(round2(feed.grossProfit - feed.operatingCost), 2);
    expect(feed.operatingCost).toBeGreaterThan(0); // we backfilled real costs
    // Sanity: net margin matches if revenue > 0
    if (feed.totalRevenue > 0) {
      const expected = Number(((feed.netProfit / feed.totalRevenue) * 100).toFixed(1));
      expect(feed.netMargin).toBe(expected);
    }
  });

  it("Salaries category includes both Elio and Naseer salaries (≥ 175,000 AED)", async () => {
    const summary = await getOperatingCostSummary();
    const salaries = summary.byCategory.find((c) => c.category === "salaries");
    expect(salaries).toBeDefined();
    expect(salaries!.total).toBeGreaterThanOrEqual(175000);
  });

  it("Rent category total matches the workbook (90,000 AED exact)", async () => {
    const summary = await getOperatingCostSummary();
    const rent = summary.byCategory.find((c) => c.category === "rent");
    expect(rent).toBeDefined();
    expect(round2(rent!.total)).toBe(90000);
  });

  it("filter by category returns only that category", async () => {
    const rent = await listOperatingCostRows({ category: "rent", limit: 1000 });
    expect(rent.length).toBeGreaterThan(0);
    for (const r of rent) {
      expect(r.category).toBe("rent");
      expect(r.classification).toBe("operating");
    }
  });
});
