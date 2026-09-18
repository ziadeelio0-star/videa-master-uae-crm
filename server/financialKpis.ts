/**
 * Single source of truth for every financial KPI shown in the CRM.
 *
 * Definitions (immutable, applied identically everywhere — Dashboard,
 * Operating Cost page, Receivables, P&L by period, exports, tests):
 *
 *   totalRevenue      = SUM(transactions.amount)                  // workbook-truth, includes Tools + Sharpening
 *   totalCogs         = SUM(transactions.cogs)                    // workbook-truth, includes both types
 *   grossProfit       = totalRevenue − totalCogs
 *   grossMargin (%)   = totalRevenue > 0 ? grossProfit / totalRevenue × 100 : 0
 *   operatingCost     = SUM(operatingCosts.amount WHERE classification='operating')
 *   netProfit         = grossProfit − operatingCost
 *   netMargin (%)     = totalRevenue > 0 ? netProfit / totalRevenue × 100 : 0
 *   outstanding       = SUM(clients.outstandingBalance)           // point-in-time, always all-time
 *   collected         = max(0, totalRevenue − outstanding)        // clamped at 0
 *   collectionRate %  = totalRevenue > 0 ? round(collected / totalRevenue × 100), clamped 0..100
 *
 * IMPORTANT — period semantics:
 *   - When `year`/`month` is supplied, totalRevenue / totalCogs / grossProfit /
 *     operatingCost / netProfit are scoped to that period.
 *   - `outstanding` and `collectionRate` are ALWAYS computed against all-time
 *     totals, since outstanding receivables are a point-in-time balance and
 *     mixing them with a period-scoped revenue produces a meaningless ratio.
 */
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./db";

export interface FinancialKpis {
  year: number | null;
  month: number | null;
  totalRevenue: number;
  toolsRevenue: number;
  sharpeningRevenue: number;
  totalCogs: number;
  toolsCogs: number;
  sharpeningCogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingCost: number;
  netProfit: number;
  netMargin: number;
  outstanding: number;
  collected: number;
  collectionRate: number;
  transactionCount: number;
  invoiceCount: number;
  availableYears: number[];
}

const EMPTY_KPIS: FinancialKpis = {
  year: null,
  month: null,
  totalRevenue: 0,
  toolsRevenue: 0,
  sharpeningRevenue: 0,
  totalCogs: 0,
  toolsCogs: 0,
  sharpeningCogs: 0,
  grossProfit: 0,
  grossMargin: 0,
  operatingCost: 0,
  netProfit: 0,
  netMargin: 0,
  outstanding: 0,
  collected: 0,
  collectionRate: 0,
  transactionCount: 0,
  invoiceCount: 0,
  availableYears: [],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getFinancialKpis(filter?: {
  year?: number | null;
  month?: number | null;
}): Promise<FinancialKpis> {
  const d = await getDb();
  if (!d) return { ...EMPTY_KPIS };

  const yearFilter = filter?.year && filter.year > 0 ? filter.year : null;
  const monthFilter =
    filter?.month && filter.month >= 1 && filter.month <= 12
      ? filter.month
      : null;

  const txWhere: SQL[] = [];
  if (yearFilter !== null) txWhere.push(sql`YEAR(transactionDate) = ${yearFilter}`);
  if (monthFilter !== null) txWhere.push(sql`MONTH(transactionDate) = ${monthFilter}`);
  const txWhereClause =
    txWhere.length > 0
      ? sql.join([sql`WHERE `, sql.join(txWhere, sql` AND `)])
      : sql``;

  const ocWhere: SQL[] = [sql`classification = 'operating'`];
  if (yearFilter !== null) ocWhere.push(sql`YEAR(txDate) = ${yearFilter}`);
  if (monthFilter !== null) ocWhere.push(sql`MONTH(txDate) = ${monthFilter}`);
  const ocWhereClause = sql.join([sql`WHERE `, sql.join(ocWhere, sql` AND `)]);

  // 1. Revenue + COGS by transaction type (Tools vs Sharpening). We sum BOTH
  //    types — sharpening services can carry COGS (e.g. consumables) and
  //    must be included in the company-wide COGS total.
  const txRes = await d.execute(sql`
    SELECT type,
           COALESCE(SUM(amount), 0) AS revenue,
           COALESCE(SUM(cogs), 0) AS cogs,
           COUNT(*) AS cnt
    FROM transactions
    ${txWhereClause}
    GROUP BY type
  `);
  const txRows = (txRes as unknown as [
    Array<{ type: string; revenue: string | number; cogs: string | number; cnt: number }>,
  ])[0];

  let toolsRevenue = 0;
  let sharpeningRevenue = 0;
  let toolsCogs = 0;
  let sharpeningCogs = 0;
  let transactionCount = 0;
  for (const r of txRows) {
    const rev = Number(r.revenue);
    const cogs = Number(r.cogs);
    const cnt = Number(r.cnt);
    transactionCount += cnt;
    if (r.type === "purchase" || r.type === "tool" || r.type === "tools") {
      toolsRevenue += rev;
      toolsCogs += cogs;
    } else if (r.type === "sharpening") {
      sharpeningRevenue += rev;
      sharpeningCogs += cogs;
    } else {
      // Unknown type — count its revenue/COGS into tools by default to avoid
      // dropping money from the totals.
      toolsRevenue += rev;
      toolsCogs += cogs;
    }
  }
  const totalRevenue = round2(toolsRevenue + sharpeningRevenue);
  const totalCogs = round2(toolsCogs + sharpeningCogs);
  const grossProfit = round2(totalRevenue - totalCogs);
  const grossMargin =
    totalRevenue > 0
      ? Number(((grossProfit / totalRevenue) * 100).toFixed(1))
      : 0;

  // 2. Distinct invoice count over the same period.
  const invRes = await d.execute(sql`
    SELECT COUNT(DISTINCT invoiceNumber) AS cnt
    FROM transactions
    ${txWhereClause}
  `);
  const invRows = (invRes as unknown as [Array<{ cnt: number }>])[0];
  const invoiceCount = invRows.length > 0 ? Number(invRows[0]!.cnt) : 0;

  // 3. Operating cost over the period (operating-classification only — never
  //    inventory or shipping; those are accounted for in COGS).
  const opRes = await d.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM operatingCosts
    ${ocWhereClause}
  `);
  const opRows = (opRes as unknown as [Array<{ total: string | number }>])[0];
  const operatingCost =
    opRows.length > 0 ? round2(Number(opRows[0]!.total)) : 0;
  const netProfit = round2(grossProfit - operatingCost);
  const netMargin =
    totalRevenue > 0
      ? Number(((netProfit / totalRevenue) * 100).toFixed(1))
      : 0;

  // 4. Outstanding & collection rate. Both are computed against ALL-TIME
  //    revenue/outstanding regardless of the period filter — outstanding is
  //    a point-in-time figure and mixing it with a period-scoped revenue
  //    produces a misleading ratio.
  const outRes = await d.execute(sql`
    SELECT COALESCE(SUM(CAST(outstandingBalance AS DECIMAL(14,2))), 0) AS total
    FROM clients
  `);
  const outRows = (outRes as unknown as [Array<{ total: string | number }>])[0];
  const outstanding =
    outRows.length > 0 ? round2(Math.max(0, Number(outRows[0]!.total))) : 0;

  const allTimeRevRes = await d.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
  `);
  const allTimeRevRows = (allTimeRevRes as unknown as [
    Array<{ total: string | number }>,
  ])[0];
  const allTimeRevenue =
    allTimeRevRows.length > 0 ? round2(Number(allTimeRevRows[0]!.total)) : 0;
  const collected = round2(Math.max(0, allTimeRevenue - outstanding));
  const collectionRate =
    allTimeRevenue > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((collected / allTimeRevenue) * 100)),
        )
      : 0;

  // 5. Years available in the dataset for the UI selector.
  const yearsRes = await d.execute(sql`
    SELECT DISTINCT YEAR(transactionDate) AS y FROM transactions WHERE transactionDate IS NOT NULL
    UNION
    SELECT DISTINCT YEAR(txDate) AS y FROM operatingCosts WHERE txDate IS NOT NULL
    ORDER BY y ASC
  `);
  const yearsRows = (yearsRes as unknown as [Array<{ y: number }>])[0];
  const availableYears = yearsRows
    .map((r) => Number(r.y))
    .filter((y) => y > 0);

  return {
    year: yearFilter,
    month: monthFilter,
    totalRevenue,
    toolsRevenue: round2(toolsRevenue),
    sharpeningRevenue: round2(sharpeningRevenue),
    totalCogs,
    toolsCogs: round2(toolsCogs),
    sharpeningCogs: round2(sharpeningCogs),
    grossProfit,
    grossMargin,
    operatingCost,
    netProfit,
    netMargin,
    outstanding,
    collected,
    collectionRate,
    transactionCount,
    invoiceCount,
    availableYears,
  };
}

// Convenience wrapper that mirrors the DashboardKpisV2 shape for legacy callers
// while delegating ALL math to getFinancialKpis().
export async function getDashboardKpisV2Unified() {
  const k = await getFinancialKpis();
  // Active clients count is unrelated to KPI math — keep it co-located.
  const db = await getDb();
  if (!db) {
    return {
      totalRevenue: k.totalRevenue,
      toolsRevenue: k.toolsRevenue,
      sharpeningRevenue: k.sharpeningRevenue,
      activeClients: 0,
      monthlyRevenue: 0,
      outstanding: k.outstanding,
      toolsCogs: k.toolsCogs,
      totalCogs: k.totalCogs,
      grossProfit: k.grossProfit,
      grossMargin: k.grossMargin,
    };
  }
  const activeClientsRes = await db.execute(sql`SELECT COUNT(*) AS count FROM clients`);
  const activeClients = Number((activeClientsRes as any)[0]?.[0]?.count ?? 0);

  // Current calendar-month revenue (kept for the legacy "monthly revenue" chip).
  const monthlyRes = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE DATE_FORMAT(transactionDate, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
  `);
  const monthlyRevenue = Number((monthlyRes as any)[0]?.[0]?.total ?? 0);

  return {
    totalRevenue: k.totalRevenue,
    toolsRevenue: k.toolsRevenue,
    sharpeningRevenue: k.sharpeningRevenue,
    activeClients,
    monthlyRevenue,
    outstanding: k.outstanding,
    toolsCogs: k.toolsCogs,
    totalCogs: k.totalCogs,
    grossProfit: k.grossProfit,
    grossMargin: k.grossMargin,
  };
}
