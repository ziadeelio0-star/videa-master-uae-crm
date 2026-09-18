import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

const [rows] = await conn.execute(
  "SELECT COUNT(*) as cnt, ROUND(SUM(cogs),2) as totalCogs, ROUND(SUM(amount),2) as totalRev FROM transactions WHERE YEAR(transactionDate) = 2026 AND MONTH(transactionDate) = 7"
);
console.log("CRM July 2026:", rows[0]);

const [details] = await conn.execute(
  "SELECT invoiceNumber, transactionDate, ROUND(amount,2) as amount, ROUND(cogs,2) as cogs, type FROM transactions WHERE YEAR(transactionDate) = 2026 AND MONTH(transactionDate) = 7 ORDER BY transactionDate, invoiceNumber"
);
console.log("\nJuly 2026 transactions:");
details.forEach(r => console.log(`  Inv#${r.invoiceNumber} ${new Date(r.transactionDate).toISOString().slice(0,10)} Rev=${r.amount} COGS=${r.cogs} ${r.type}`));

// Also get total COGS for all time
const [total] = await conn.execute(
  "SELECT ROUND(SUM(cogs),2) as totalCogs FROM transactions"
);
console.log("\nAll-time total COGS in CRM:", total[0].totalCogs);

// Monthly COGS breakdown
const [monthly] = await conn.execute(
  "SELECT YEAR(transactionDate) as y, MONTH(transactionDate) as m, ROUND(SUM(cogs),2) as cogs, COUNT(*) as cnt FROM transactions GROUP BY y, m ORDER BY y, m"
);
console.log("\nMonthly COGS in CRM:");
monthly.forEach(r => console.log(`  ${r.y}-${String(r.m).padStart(2,'0')}: ${r.cnt} txns, COGS=${r.cogs}`));

await conn.end();
