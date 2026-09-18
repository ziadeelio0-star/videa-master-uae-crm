import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL);
const [rows] = await db.execute(/*sql*/`
  SELECT invoiceNumber, clientId, type,
         COUNT(*) as lineItems,
         SUM(CAST(amount AS DECIMAL(12,2))) as totalRevenue,
         SUM(CAST(cogs AS DECIMAL(12,2))) as totalCogs,
         MIN(transactionDate) as invoiceDate
  FROM transactions
  WHERE invoiceNumber IS NOT NULL AND invoiceNumber != ''
  GROUP BY invoiceNumber, clientId, type
  ORDER BY totalRevenue DESC
  LIMIT 10
`);
console.log(JSON.stringify(rows, null, 2));

// Also check total unique invoices
const [countRows] = await db.execute(/*sql*/`
  SELECT COUNT(DISTINCT invoiceNumber) as totalInvoices
  FROM transactions
  WHERE invoiceNumber IS NOT NULL AND invoiceNumber != ''
`);
console.log("\nTotal unique invoices:", countRows[0].totalInvoices);

process.exit(0);
