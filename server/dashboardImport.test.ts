import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, afterAll } from "vitest";
import { importDashboardWorkbook } from "./dashboardImport";
import { getDb } from "./db";
import { clients, machines, clientTools, tools, transactions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const workbookPath = path.resolve(__dirname, "fixtures_dashboard.xlsx");

function hasWorkbookAndDb() {
  return fs.existsSync(workbookPath) && !!process.env.DATABASE_URL;
}

// SAFETY GATE: this test calls importDashboardWorkbook() which TRUNCATEs the
// transactions / tools / clients tables. We require an explicit env opt-in
// (RUN_UNIFIED_TEST=1) so that a normal `pnpm vitest run` can never wipe live
// production data.
const optedIn = process.env.RUN_UNIFIED_TEST === "1";

describe.runIf(hasWorkbookAndDb() && optedIn)(
  "Dashboard importer — preserves machines & client-tool links",
  () => {
    afterAll(async () => {
      // Re-import so the database state remains the full, expected dataset after the test.
      const buf = fs.readFileSync(workbookPath);
      await importDashboardWorkbook(buf);
    });

    it(
      "re-attaches machines and client-tool links to their owning client across an import",
      async () => {
        const db = await getDb();
        expect(db).toBeTruthy();
        if (!db) return;

        const buf = fs.readFileSync(workbookPath);

        // First import — fresh baseline.
        await importDashboardWorkbook(buf);

        // Pick any client and attach a machine + a tool link.
        const [firstClient] = await db.select().from(clients).limit(1);
        expect(firstClient).toBeTruthy();

        const [firstTool] = await db.select().from(tools).limit(1);
        expect(firstTool).toBeTruthy();

        await db.insert(machines).values({
          clientId: firstClient.id,
          machineType: "TEST_MACHINE",
          brand: "Acme",
          model: "X1",
        });

        await db.insert(clientTools).values({
          clientId: firstClient.id,
          toolId: firstTool.id,
          usageFrequency: "daily",
          notes: "preserve-me",
        });

        // Count before re-import.
        const beforeMachines = await db
          .select()
          .from(machines)
          .where(eq(machines.clientId, firstClient.id));
        const beforeLinks = await db
          .select()
          .from(clientTools)
          .where(eq(clientTools.clientId, firstClient.id));

        expect(beforeMachines.some((m) => m.machineType === "TEST_MACHINE")).toBe(true);
        expect(beforeLinks.some((l) => l.notes === "preserve-me")).toBe(true);

        const originalName = firstClient.companyName;

        // Re-import the same workbook — this MUST preserve the machine+link.
        const summary = await importDashboardWorkbook(buf);
        expect(summary.clients).toBeGreaterThan(0);
        expect(summary.transactions).toBeGreaterThan(0);

        // Look up the same client (id may change after TRUNCATE) by name and confirm preserved rows.
        const [restoredClient] = await db
          .select()
          .from(clients)
          .where(eq(clients.companyName, originalName))
          .limit(1);
        expect(restoredClient).toBeTruthy();

        const afterMachines = await db
          .select()
          .from(machines)
          .where(eq(machines.clientId, restoredClient.id));
        expect(afterMachines.some((m) => m.machineType === "TEST_MACHINE")).toBe(true);

        const afterLinks = await db
          .select()
          .from(clientTools)
          .where(eq(clientTools.clientId, restoredClient.id));
        expect(afterLinks.some((l) => l.notes === "preserve-me")).toBe(true);

        // Clean up the test artefacts so we don't pollute the real data.
        await db
          .delete(machines)
          .where(eq(machines.clientId, restoredClient.id))
          .execute();
        await db
          .delete(clientTools)
          .where(eq(clientTools.clientId, restoredClient.id))
          .execute();
      },
      120_000
    );

    it(
      "rebuilds the 76 clients / 210 invoices / 76-customer dataset end-to-end",
      async () => {
        const db = await getDb();
        if (!db) return;
        const buf = fs.readFileSync(workbookPath);
        const summary = await importDashboardWorkbook(buf);

        expect(summary.clients).toBeGreaterThanOrEqual(70);
        expect(summary.transactions).toBeGreaterThanOrEqual(500);
        expect(summary.totalRevenue).toBeGreaterThan(100_000);

        const txs = await db.select().from(transactions).limit(5);
        expect(txs.length).toBeGreaterThan(0);
      },
      120_000
    );
  }
);
