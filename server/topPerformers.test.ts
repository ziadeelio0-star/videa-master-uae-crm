import { describe, it, expect } from "vitest";
import { getTopPerformers } from "./db";

const SHOULD_RUN = !!process.env.DATABASE_URL;

describe.skipIf(!SHOULD_RUN)("getTopPerformers \u2014 leaderboard contract", () => {
  it("returns name + margin fraction for every row, sorted by revenue desc", async () => {
    const rows = await getTopPerformers(10);
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      // Mandatory fields the Dashboard leaderboard renders.
      expect(r.id).toBeTypeOf("number");
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.companyName).toBe(r.name);
      expect(r.totalRevenue).toBeGreaterThan(0);
      expect(typeof r.invoiceCount).toBe("number");
      // margin is a 0..1 fraction (the UI multiplies by 100 itself).
      expect(typeof r.margin).toBe("number");
      expect(Number.isFinite(r.margin)).toBe(true);
      expect(r.margin).toBeLessThanOrEqual(1);
      expect(r.margin).toBeGreaterThanOrEqual(-5); // allow large negative for under-water rows
    }

    // Sorted by revenue descending.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].totalRevenue).toBeGreaterThanOrEqual(rows[i].totalRevenue);
    }
  });

  it("filters out rows with zero revenue (avoids ghost leaderboard entries)", async () => {
    const rows = await getTopPerformers(50);
    for (const r of rows) {
      expect(r.totalRevenue).toBeGreaterThan(0);
    }
  });
});
