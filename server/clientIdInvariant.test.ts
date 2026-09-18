import { describe, it, expect } from "vitest";
import mysql from "mysql2/promise";

/**
 * Invariant: every client's primary key MUST equal its Excel client_id.
 * If this test ever fails, an out-of-band insert or a bad sync has broken
 * 1:1 reconciliation with the source workbook.
 */
describe("Client ID invariant", () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    it.skip("DATABASE_URL not set; skipping live-DB invariant", () => {});
    return;
  }

  it("id == excelClientId for every client", async () => {
    const conn = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true } });
    try {
      const [rows] = await conn.query<any[]>(
        "SELECT COUNT(*) AS bad FROM clients WHERE excelClientId IS NULL OR id != excelClientId"
      );
      expect(Number(rows[0].bad)).toBe(0);
    } finally {
      await conn.end();
    }
  });

  it("total outstanding is finite, non-negative, and matches the per-row sum", async () => {
    // Sanity: total outstanding must be non-negative & match SUM of rows. We
    // intentionally do not pin the figure to a hard-coded number because the
    // workbook is re-uploaded frequently — a pinned assertion would break
    // every sync. The invariant is structural, not numeric.
    const conn = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true } });
    try {
      const [aggRows] = await conn.query<any[]>(
        "SELECT COALESCE(SUM(outstandingBalance), 0) AS total, COUNT(*) AS n FROM clients"
      );
      const total = Number(aggRows[0].total);
      const n = Number(aggRows[0].n);
      expect(Number.isFinite(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(n).toBeGreaterThan(0);

      // Cross-check: row-by-row sum equals the aggregate.
      const [rowAll] = await conn.query<any[]>(
        "SELECT outstandingBalance FROM clients"
      );
      const handSum = (rowAll as any[]).reduce(
        (s, r) => s + Number(r.outstandingBalance ?? 0),
        0
      );
      expect(Math.round(handSum * 100) / 100).toBeCloseTo(
        Math.round(total * 100) / 100,
        2
      );
    } finally {
      await conn.end();
    }
  });
});
