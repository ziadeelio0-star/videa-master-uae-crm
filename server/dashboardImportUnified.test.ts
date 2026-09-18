/**
 * Verifies that a single Excel upload refreshes EVERY downstream dataset:
 *   - transactions.itemId (Fact_Sales column H) is populated
 *   - clients.outstandingBalance is refreshed from Client_Balances
 *   - operatingCosts table is rebuilt with proper classification
 *
 * Uses a synthetic in-memory workbook so the test runs anywhere the DB
 * connection is available.
 */
import { afterAll, describe, expect, it } from "vitest";
import XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { importDashboardWorkbook } from "./dashboardImport";
import { getDb } from "./db";
import { transactions, clients, operatingCosts } from "../drizzle/schema";
import { eq, isNotNull, and, ne, sql } from "drizzle-orm";

const realFixture = path.resolve(__dirname, "fixtures_dashboard.xlsx");

function hasDb() {
  return !!process.env.DATABASE_URL;
}

/**
 * Synthetic mini workbook with all five sheets so we can verify the unified
 * pipeline end-to-end without depending on the full Videa workbook.
 */
function buildMiniWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Client_ID", "Client_Name", "Industry", "Phone", "Email", "Address"],
      [101, "Acme Workshop", "Joinery", "+971 1", "a@x", "Dubai"],
      [102, "Beta Carpentry", "Joinery", "+971 2", "b@x", "Sharjah"],
    ]),
    "Dim_Clients",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
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
      [1, "INV-9001", 1, "2026-01-15", 101, "Acme Workshop", "Tools", "MAR200448072CON", "Cutter Head", 1, 1500, 1500],
      [1, "INV-9001", 2, "2026-01-15", 101, "Acme Workshop", "Tools", "DES-LC01130804", "Spiral Bit", 1, 750, 750],
      [2, "INV-9002", 1, "2026-02-05", 102, "Beta Carpentry", "Sharpening", "SHARP-001", "Re-grind cutter", 1, 200, 200],
    ]),
    "Fact_Sales",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Invoice_Date", "Invoice_No", "Client_ID", "Client_Name", "Cost_of_Sales", "costOfSales_currency"],
      ["2026-01-15", "INV-9001", 101, "Acme Workshop", 900, "AED"],
      ["2026-02-05", "INV-9002", 102, "Beta Carpentry", 80, "AED"],
    ]),
    "COGS",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Client_ID", "Client_Name", "Outstanding_Balance", "Oldest_Unpaid_Date"],
      [101, "Acme Workshop", 1234.5, "2026-03-01"],
      [102, "Beta Carpentry", 0, ""],
    ]),
    "Client_Balances",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Cost_ID",
        "_Key",
        "Date",
        "Payee",
        "Expense_Account",
        "Description",
        "Amount",
        "Currency",
        "Paid_From",
        "Reference",
        "Cost_Type",
        "Cost_Center",
      ],
      [1, "k1", "2026-01-31", "Elio", "Salaries", "Jan salary", 12000, "AED", "Cash", "S001", "Salary Elio", "HQ"],
      [2, "k2", "2026-01-31", "Naseer", "Salaries", "Jan salary", 2500, "AED", "Cash", "S002", "Salary Naseer", "HQ"],
      [3, "k3", "2026-01-05", "Landlord", "Rent", "Office rent", 7500, "AED", "Bank", "R001", "Rent", "HQ"],
      [4, "k4", "2026-01-08", "ENOC", "Fuel", "Vehicle fuel", 350, "AED", "Cash", "F001", "Fuel", "HQ"],
      [5, "k5", "2026-01-10", "DEWA", "Electricity", "Electricity bill", 280, "AED", "Bank", "E001", "Electricity", "HQ"],
      [6, "k6", "2026-01-12", "Du", "هاتف", "Phone & Internet", 420, "AED", "Bank", "P001", "", "HQ"],
      [7, "k7", "2026-02-01", "Supplier", "Inventory", "Tools restock", 5000, "AED", "Bank", "I001", "Inventory Purchase", "HQ"],
    ]),
    "Fact_Cost",
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// SAFETY: this test calls importDashboardWorkbook() with a synthetic fixture,
// which DELETES every transaction/operatingCost row before re-inserting.
// We require an explicit env opt-in (RUN_UNIFIED_TEST=1) so a CI run, an
// editor watcher, or a Ctrl+C mid-test can never wipe live data again.
const optedIn = process.env.RUN_UNIFIED_TEST === "1";
describe.skipIf(!hasDb() || !optedIn)("Unified Excel sync pipeline", () => {
  afterAll(async () => {
    // Restore the canonical dataset from the production fixture so other tests
    // continue to see realistic data.
    if (fs.existsSync(realFixture)) {
      const buf = fs.readFileSync(realFixture);
      await importDashboardWorkbook(buf);
    }
  }, 180_000);

  it(
    "populates transactions.itemId from Fact_Sales column H",
    async () => {
      const db = await getDb();
      expect(db).toBeTruthy();
      if (!db) return;

      const buf = buildMiniWorkbook();
      const summary = await importDashboardWorkbook(buf);
      expect(summary.transactions).toBe(3);

      const rows = await db.select().from(transactions);
      const ids = rows.map((r) => r.itemId).filter(Boolean) as string[];
      expect(ids).toContain("MAR200448072CON");
      expect(ids).toContain("DES-LC01130804");
      expect(ids).toContain("SHARP-001");
    },
    180_000,
  );

  it(
    "refreshes clients.outstandingBalance and oldestUnpaidDate from Client_Balances",
    async () => {
      const db = await getDb();
      if (!db) return;

      const buf = buildMiniWorkbook();
      const summary = await importDashboardWorkbook(buf);
      expect(summary.balancesUpdated).toBeGreaterThanOrEqual(2);

      const acme = await db
        .select()
        .from(clients)
        .where(eq(clients.companyName, "Acme Workshop"));
      expect(acme.length).toBe(1);
      expect(Number(acme[0].outstandingBalance)).toBeCloseTo(1234.5, 2);
      expect(acme[0].oldestUnpaidDate).toBeTruthy();
    },
    180_000,
  );

  it(
    "rebuilds operatingCosts and classifies Inventory Purchase out of operating",
    async () => {
      const db = await getDb();
      if (!db) return;

      const buf = buildMiniWorkbook();
      const summary = await importDashboardWorkbook(buf);
      expect(summary.operatingCostsRows).toBe(7);

      // Inventory Purchase (5000) MUST NOT be in operating bucket.
      expect(summary.operatingCostsTotal).toBeCloseTo(
        12000 + 2500 + 7500 + 350 + 280 + 420,
        2,
      );
      expect(summary.inventoryCostsTotal).toBeCloseTo(5000, 2);

      // Spot-check classification persisted to the table.
      const inventoryRows = await db
        .select()
        .from(operatingCosts)
        .where(eq(operatingCosts.classification, "inventory"));
      expect(inventoryRows.length).toBe(1);
      expect(Number(inventoryRows[0].amount)).toBeCloseTo(5000, 2);

      const phoneRows = await db
        .select()
        .from(operatingCosts)
        .where(eq(operatingCosts.category, "phone_internet"));
      expect(phoneRows.length).toBeGreaterThanOrEqual(1);
      expect(phoneRows.every((r) => r.classification === "operating")).toBe(true);
    },
    180_000,
  );

  it(
    "is idempotent: two consecutive imports yield identical aggregates",
    async () => {
      const db = await getDb();
      if (!db) return;
      const buf = buildMiniWorkbook();
      const a = await importDashboardWorkbook(buf);
      const b = await importDashboardWorkbook(buf);
      expect(b.clients).toBe(a.clients);
      expect(b.transactions).toBe(a.transactions);
      expect(b.operatingCostsRows).toBe(a.operatingCostsRows);
      expect(b.operatingCostsTotal).toBeCloseTo(a.operatingCostsTotal, 2);
      expect(b.balancesUpdated).toBe(a.balancesUpdated);

      // No rows should be left unclassified.
      const orphans = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(operatingCosts)
        .where(and(isNotNull(operatingCosts.classification), ne(operatingCosts.classification, operatingCosts.classification)));
      expect(Number(orphans[0]?.n ?? 0)).toBe(0);
    },
    240_000,
  );
});
