#!/usr/bin/env node
// Re-seed transactions with correct dates from the latest dashboard Excel.
import fs from "node:fs";
import { importDashboardWorkbook } from "../server/dashboardImport.ts";

const path = process.argv[2] ?? "/home/ubuntu/upload/pasted_file_bnaQpH_Videa-Master-DashboardFinale.xlsx";
const buf = fs.readFileSync(path);
const res = await importDashboardWorkbook(buf);
console.log(JSON.stringify(res, null, 2));
process.exit(0);
