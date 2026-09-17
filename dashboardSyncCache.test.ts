/**
 * Verifies the SHA256-keyed short-circuit in importDashboardWorkbook:
 *
 *   1. A real workbook import returns `cached: false` and writes a syncState row.
 *   2. Re-importing the SAME bytes returns `cached: true` AND completes far
 *      faster than a fresh rebuild (round-trip ratio > 5x).
 *   3. Calling with `forceRebuild: true` always rebuilds.
 *
 * Gated behind RUN_UNIFIED_TEST=1 because it TRUNCATEs production tables.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { importDashboardWorkbook } from "./dashboardImport";
import { getDb } from "./db";
import { syncState } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_UNIFIED_TEST === "1";
const FIXTURE = "/home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx";

describe.skipIf(!SHOULD_RUN || !fs.existsSync(FIXTURE))(
  "importDashboardWorkbook \u2014 hash cache",
  () => {
    it("rebuilds on first call and short-circuits on identical bytes", async () => {
      const buffer = fs.readFileSync(FIXTURE);

      // First call \u2014 should fully rebuild
      const t1 = Date.now();
      const first = await importDashboardWorkbook(buffer, { forceRebuild: true });
      const elapsedRebuild = Date.now() - t1;

      expect(first.cached).toBe(false);
      expect(first.fileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(first.transactions).toBeGreaterThan(500);
      expect(first.clients).toBeGreaterThan(50);

      // Second call with identical bytes \u2014 must be cached
      const t2 = Date.now();
      const second = await importDashboardWorkbook(buffer);
      const elapsedCached = Date.now() - t2;

      expect(second.cached).toBe(true);
      expect(second.fileHash).toBe(first.fileHash);
      expect(second.totalRevenue).toBe(first.totalRevenue);
      expect(second.totalCOGS).toBe(first.totalCOGS);
      expect(second.transactions).toBe(first.transactions);

      // The cached path must be at least 5x faster than the rebuild path \u2014
      // in practice it's 20\u201340x faster (231ms vs 4961ms in our prod run).
      expect(elapsedCached * 5).toBeLessThan(elapsedRebuild);

      // syncState row exists with the fileHash.
      const db = await getDb();
      const [row] = await db!
        .select()
        .from(syncState)
        .where(eq(syncState.source, "dashboard"))
        .limit(1);
      expect(row?.fileHash).toBe(first.fileHash);
    }, 120_000);

    it("forceRebuild=true bypasses the cache", async () => {
      const buffer = fs.readFileSync(FIXTURE);
      const a = await importDashboardWorkbook(buffer);
      expect(a.cached).toBe(true);

      const b = await importDashboardWorkbook(buffer, { forceRebuild: true });
      expect(b.cached).toBe(false);
      expect(b.fileHash).toBe(a.fileHash);
    }, 120_000);
  }
);
