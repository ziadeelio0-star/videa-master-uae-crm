/**
 * Regression tests for invoice date parsing + invoice number preservation.
 *
 * The dashboard importer used to silently fall back to `new Date()` when a
 * cell's date format confused SheetJS. That collapsed every unparsed invoice
 * into "today", which broke Manager.io reconciliation. These tests pin the
 * behaviour down:
 *
 *   1. A minimal in-memory workbook with Excel serial dates (45922 = 2025-09-22)
 *      must round-trip to an ISO string of 2025-09-22 in the transactions table.
 *   2. Every imported transaction must keep its Invoice_No so the UI can list
 *      invoices individually.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import XLSX from "xlsx";
import { findFactSalesAmountColumn, importDashboardWorkbook, normalizeClientLookupKey, resolveFactSalesGrossProfit } from "./dashboardImport";
import { getDb } from "./db";
import { transactions } from "../drizzle/schema";

const fixturePath = path.resolve(__dirname, "fixtures_dashboard.xlsx");

function hasDb() {
  return !!process.env.DATABASE_URL;
}

/** Build a tiny xlsx buffer with the two required sheets. */
function buildTinyWorkbook(): Buffer {
  const dim = [
    [
      "Client_ID",
      "Client_Name",
      "Industry",
      "Phone",
      "Email",
      "Address",
      "Manager_Customer_Key",
    ],
    [101, "ACME Fixtures Co", "Wood", "0500000000", "ops@acme.test", "Dubai", "abc-123"],
  ];

  // Excel serials:
  //  45922 -> 2025-09-22
  //  45929 -> 2025-09-29
  const fact = [
    [
      "Invoice_ID",
      "Invoice_No",
      "Invoice_Line_No",
      "Invoice_Date",
      "Client_ID",
      "Client_Name",
      "Revenue_Type",
      "Item_ID",
      "Item_Description",
      "Quantity",
      "Unit_Price",
      "Net_Revenue",
    ],
    [
      9001,
      "9001",
      1,
      45922,
      101,
      "ACME Fixtures Co",
      "Tool",
      "TST-A",
      "Test tool A",
      1,
      100,
      100,
    ],
    [
      9001,
      "9001",
      2,
      45922,
      101,
      "ACME Fixtures Co",
      "Tool",
      "TST-B",
      "Test tool B",
      2,
      50,
      100,
    ],
    [
      9002,
      "9002",
      1,
      45929,
      101,
      "ACME Fixtures Co",
      "Sharpening",
      "SRP-1",
      "Sharpening service",
      3,
      60,
      180,
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dim), "Dim_Clients");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fact), "Fact_Sales");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// SAFETY GATE: this test calls importDashboardWorkbook() which TRUNCATEs the
// transactions / tools / clients tables. We require an explicit env opt-in
// (RUN_UNIFIED_TEST=1) so that a normal `pnpm vitest run` can never wipe live
// production data.
const optedIn = process.env.RUN_UNIFIED_TEST === "1";

describe.runIf(hasDb() && optedIn)(
  "Dashboard importer — preserves invoice dates & invoice numbers",
  () => {
    // Restore the real dataset after this file runs so later tests see the full
    // fixture workbook state instead of our tiny synthetic one.
    afterAll(async () => {
      if (fs.existsSync(fixturePath)) {
        const buf = fs.readFileSync(fixturePath);
        await importDashboardWorkbook(buf);
      }
    }, 180_000);

    it(
      "parses Excel serial dates correctly and keeps every invoice number",
      async () => {
        const db = await getDb();
        expect(db).toBeTruthy();
        if (!db) return;

        const buf = buildTinyWorkbook();
        const summary = await importDashboardWorkbook(buf);
        expect(summary.transactions).toBe(3);
        expect(summary.invoices).toBe(2);

        const rows = await db.select().from(transactions);
        expect(rows.length).toBe(3);

        // Dates — 9001 must be 2025-09-22, 9002 must be 2025-09-29.
        const inv9001 = rows.filter((r) => r.invoiceNumber === "9001");
        const inv9002 = rows.filter((r) => r.invoiceNumber === "9002");
        expect(inv9001.length).toBe(2);
        expect(inv9002.length).toBe(1);

        const iso = (d: Date) => d.toISOString().slice(0, 10);
        for (const r of inv9001) expect(iso(r.transactionDate)).toBe("2025-09-22");
        for (const r of inv9002) expect(iso(r.transactionDate)).toBe("2025-09-29");

        // Invoice numbers preserved on every row.
        for (const r of rows) expect(r.invoiceNumber).toMatch(/^9001|9002$/);
      },
      60_000
    );
  }
);

describe("Dashboard importer client-name normalization", () => {
  it("matches Arabic presentation forms and whitespace to the same client key", () => {
    const dimClientName = "ﺔﯿﻨﺋاﺪﻠﻟا تﺎﻋﺎﻨﺼﻠﻟ ﻮﻜﻟﺎﺳ ﺔﻛﺮﺷ ﻊﻨﺼﻣ";
    const factSalesName = "ﺔﯾﻧﺋادﻠﻟا   تﺎﻋﺎﻧﺻﻠﻟ وﻛﻟﺎﺳ ﺔﻛرﺷ ﻊﻧﺻﻣ";
    expect(normalizeClientLookupKey(factSalesName)).toBe(normalizeClientLookupKey(dimClientName));
  });

  it("prefers the workbook Gross_Profit column over Net_Revenue", () => {
    expect(findFactSalesAmountColumn(["Net_Revenue", "Gross_Profit"])).toBe(1);
    expect(findFactSalesAmountColumn(["Net_Revenue"])).toBe(0);
  });

  it("rebuilds Gross_Profit from Net_Revenue and COGS when the Excel formula cache is zero", () => {
    expect(resolveFactSalesGrossProfit([1200, 200, 0], 2, 0, 1)).toBe(1000);
    expect(resolveFactSalesGrossProfit([1200, 200, 1000], 2, 0, 1)).toBe(1000);
  });
});
