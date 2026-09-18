/**
 * Emergency: re-import the latest Videa workbook to restore the full dataset
 * after the unified-import vitest spec was interrupted mid-run.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filenameLocal = fileURLToPath(import.meta.url);
const __dirnameLocal = path.dirname(__filenameLocal);

async function main() {
  const candidates = [
    "/home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx",
    "/home/ubuntu/cutting-tools-crm/server/fixtures_dashboard.xlsx",
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    console.error("No workbook found in candidates:", candidates);
    process.exit(2);
  }
  console.log("Restoring from:", filePath, `(${fs.statSync(filePath).size} bytes)`);

  // Late import so dotenv etc. is loaded first via process env injection.
  const { importDashboardWorkbook } = await import(
    path.resolve(__dirnameLocal, "..", "server", "dashboardImport.ts")
  );

  const buf = fs.readFileSync(filePath);
  const t0 = Date.now();
  const summary = await importDashboardWorkbook(buf);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== RESTORE COMPLETE in", dt, "s ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
