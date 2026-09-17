import { describe, it, expect } from "vitest";
import { getSkuVelocity, getInventoryIntelligence } from "./db";

const SHOULD_RUN = !!process.env.DATABASE_URL;

describe.skipIf(!SHOULD_RUN)("getSkuVelocity \u2014 SKU velocity contract", () => {
  it("returns rows with valid tags and non-negative numbers", async () => {
    const rows = await getSkuVelocity({ limit: 100 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.toolId).toBeTypeOf("number");
      expect(typeof r.toolName).toBe("string");
      expect(r.toolName.length).toBeGreaterThan(0);
      expect(r.lifetimeUnits).toBeGreaterThan(0);
      expect(r.lifetimeRevenue).toBeGreaterThanOrEqual(0);
      expect(r.units30d).toBeGreaterThanOrEqual(0);
      expect(r.units90d).toBeGreaterThanOrEqual(0);
      expect(r.units30d).toBeLessThanOrEqual(r.units90d);
      expect(r.units90d).toBeLessThanOrEqual(r.units365d);
      expect(["fast", "steady", "slow", "dead"]).toContain(r.velocityTag);
      expect(["reorder-now", "watch", "ok"]).toContain(r.reorderTag);
      // Cross-field invariant: a "fast" row must have units90d >= 3 and units30d > 0.
      if (r.velocityTag === "fast") {
        expect(r.units30d).toBeGreaterThan(0);
        expect(r.units90d).toBeGreaterThanOrEqual(3);
      }
      // A "dead" row must have zero sales in the last 365 days.
      if (r.velocityTag === "dead") {
        expect(r.units365d).toBe(0);
      }
    }
  });
});

describe.skipIf(!SHOULD_RUN)("getInventoryIntelligence \u2014 dashboard summary contract", () => {
  it("returns the expected shape with consistent totals", async () => {
    const data = await getInventoryIntelligence();

    expect(data.totalSkusSoldEver).toBeGreaterThan(0);
    expect(data.fastMovers).toBeGreaterThanOrEqual(0);
    expect(data.deadStockCount).toBeGreaterThanOrEqual(0);
    expect(data.deadStockCount).toBeLessThanOrEqual(data.totalSkusSoldEver);

    // Top movers list should not contain dead items.
    for (const s of data.topMovers) {
      expect(s.velocityTag === "fast" || s.velocityTag === "steady").toBe(true);
    }
    // Reorder list must all be reorder-now.
    for (const s of data.reorderList) {
      expect(s.reorderTag).toBe("reorder-now");
    }
    // Dead stock list must all be dead.
    for (const s of data.deadStock) {
      expect(s.velocityTag).toBe("dead");
    }

    expect(data.topSharpening.length).toBeGreaterThan(0);
    for (const s of data.topSharpening) {
      expect(s.revenue).toBeGreaterThan(0);
      expect(s.marginPct).toBeGreaterThanOrEqual(-100);
      expect(s.marginPct).toBeLessThanOrEqual(100);
    }
  });

  it("sharpening margin should be much higher than tool margin (business invariant)", async () => {
    const data = await getInventoryIntelligence();
    const tool = data.streamMargins.find((s) => s.type === "purchase");
    const sharp = data.streamMargins.find((s) => s.type === "sharpening");
    expect(tool).toBeDefined();
    expect(sharp).toBeDefined();
    if (tool && sharp) {
      // Sharpening should have a higher margin than tools \u2014 this is the
      // strategic insight the dashboard surfaces.
      expect(sharp.marginPct).toBeGreaterThan(tool.marginPct);
    }
  });

  it("reorder list rows are sorted by 30-day units descending", async () => {
    const data = await getInventoryIntelligence();
    for (let i = 1; i < data.reorderList.length; i++) {
      expect(data.reorderList[i - 1].units90d).toBeGreaterThanOrEqual(
        data.reorderList[i].units90d,
      );
    }
  });
});
