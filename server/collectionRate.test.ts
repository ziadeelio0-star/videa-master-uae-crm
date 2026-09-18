/**
 * Verifies the Collection Rate KPI on the Dashboard:
 *
 *   collectionRate = (totalRevenue \u2212 outstanding) / totalRevenue \u00d7 100
 *
 * - totalRevenue is SUM(transactions.amount) (workbook-truth)
 * - outstanding is SUM(clients.outstandingBalance) (workbook-truth from
 *   Client_Balances), NOT inferred from per-row transaction.status.
 *
 * Skipped automatically when DATABASE_URL is missing (e.g. on a fresh CI box).
 */
import { describe, it, expect } from "vitest";
import { getQuickStats } from "./db";

const SHOULD_RUN = !!process.env.DATABASE_URL;

describe.skipIf(!SHOULD_RUN)("getQuickStats \u2014 collection rate math", () => {
  it("returns collectionRate = (revenue \u2212 outstanding) / revenue, clamped 0..100", async () => {
    const stats = await getQuickStats();

    expect(typeof stats.totalRevenue).toBe("number");
    expect(typeof stats.totalOutstanding).toBe("number");
    expect(typeof stats.totalPaid).toBe("number");
    expect(typeof stats.collectionRate).toBe("number");

    // Bounds.
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(stats.totalOutstanding).toBeGreaterThanOrEqual(0);
    expect(stats.collectionRate).toBeGreaterThanOrEqual(0);
    expect(stats.collectionRate).toBeLessThanOrEqual(100);

    // Identity: totalPaid + totalOutstanding == totalRevenue (or 0 outstanding clamps).
    if (stats.totalRevenue >= stats.totalOutstanding) {
      expect(stats.totalPaid).toBeCloseTo(
        stats.totalRevenue - stats.totalOutstanding,
        2
      );
    } else {
      // If outstanding > revenue (legacy carry-over), totalPaid clamps to 0.
      expect(stats.totalPaid).toBe(0);
    }

    // Formula: rate matches the rounded ratio.
    if (stats.totalRevenue > 0) {
      const expected = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((stats.totalRevenue - stats.totalOutstanding) /
              stats.totalRevenue) *
              100
          )
        )
      );
      expect(stats.collectionRate).toBe(expected);
    }
  });

  it("does not return 100% when there is real outstanding receivable", async () => {
    const stats = await getQuickStats();
    if (stats.totalOutstanding > 0 && stats.totalRevenue > 0) {
      expect(stats.collectionRate).toBeLessThan(100);
    }
  });
});
