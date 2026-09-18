import { describe, it, expect, beforeAll } from "vitest";
import { importDashboardWorkbook } from "./dashboardImport";
import * as fs from "fs";
import * as path from "path";

// SAFETY GATE: this test calls importDashboardWorkbook() which TRUNCATEs the
// transactions / tools / clients tables. We require an explicit env opt-in
// (RUN_UNIFIED_TEST=1) so that a normal `pnpm vitest run` can never wipe live
// production data.
const optedIn = process.env.RUN_UNIFIED_TEST === "1";

describe.runIf(optedIn)("Excel Dashboard Sync", () => {
  let excelBuffer: Buffer;

  beforeAll(() => {
    // Load the test fixture Excel file
    const fixturePath = path.join(__dirname, "fixtures_dashboard.xlsx");
    if (fs.existsSync(fixturePath)) {
      excelBuffer = fs.readFileSync(fixturePath);
    }
  });

  it("should import Excel dashboard and return summary", async () => {
    if (!excelBuffer) {
      console.log("Skipping test - fixture file not found");
      return;
    }

    const summary = await importDashboardWorkbook(excelBuffer);

    expect(summary).toBeDefined();
    expect(summary.clients).toBeGreaterThan(0);
    expect(summary.tools).toBeGreaterThan(0);
    expect(summary.transactions).toBeGreaterThan(0);
    expect(summary.invoices).toBeGreaterThan(0);
    expect(summary.totalRevenue).toBeGreaterThan(0);
    expect(Array.isArray(summary.warnings)).toBe(true);
  });

  it("should handle invalid Excel file", async () => {
    const invalidBuffer = Buffer.from("not a valid excel file");

    try {
      await importDashboardWorkbook(invalidBuffer);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
    }
  });

  it("should preserve data structure across imports", async () => {
    if (!excelBuffer) {
      console.log("Skipping test - fixture file not found");
      return;
    }

    // First import
    const summary1 = await importDashboardWorkbook(excelBuffer);

    // Second import (should replace old data)
    const summary2 = await importDashboardWorkbook(excelBuffer);

    // Both should have same structure
    expect(summary1.clients).toBe(summary2.clients);
    expect(summary1.tools).toBe(summary2.tools);
    expect(summary1.transactions).toBe(summary2.transactions);
    expect(summary1.totalRevenue).toBe(summary2.totalRevenue);
  });
});
