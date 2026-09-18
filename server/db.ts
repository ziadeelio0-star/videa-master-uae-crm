import { and, desc, eq, like, or, sql, sum, count, SQL, isNotNull, ne, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getConnectionString } from "@netlify/database";
import pg from "pg";
import {
  InsertUser,
  users,
  clients,
  machines,
  tools,
  clientTools,
  transactions,
  InsertClient,
  InsertMachine,
  InsertTool,
  InsertClientTool,
  InsertTransaction,
  operatingCosts,
  type OperatingCost,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;
export async function getDb() {
  if (!_db) {
    try { _pool = new pg.Pool({ connectionString: getConnectionString() }); _db = drizzle(_pool); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/* ------------------------ Users ------------------------ */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ------------------------ Clients ------------------------ */

export async function listClients(search?: string, industry?: string, activityLevel?: string) {
  const db = await requireDb();
  const conditions: SQL[] = [];
  if (search && search.trim()) {
    // Split on whitespace so "khan saheb", "khansaheb civil", etc. all match.
    // Each token must match anywhere across companyName / contactPerson / email / address.
    // Use LOWER() on both sides for true case-insensitive matching (collation-independent).
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const pattern = `%${tok}%`;
      conditions.push(
        sql`(
          LOWER(${clients.companyName}) LIKE ${pattern}
          OR LOWER(COALESCE(${clients.contactPerson}, '')) LIKE ${pattern}
          OR LOWER(COALESCE(${clients.email}, '')) LIKE ${pattern}
          OR LOWER(COALESCE(${clients.address}, '')) LIKE ${pattern}
        )`
      );
    }
  }
  if (industry) conditions.push(eq(clients.industry, industry));
  if (activityLevel) conditions.push(eq(clients.activityLevel, activityLevel as any));
  const q = conditions.length > 0
    ? db.select().from(clients).where(and(...conditions))
    : db.select().from(clients);
  return await q.orderBy(clients.companyName);
}

export async function getClientById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0];
}

export async function createClient(data: InsertClient) {
  const db = await requireDb();
  const rows = await db.insert(clients).values(data).returning();
  return rows[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await requireDb();
  await db.update(clients).set(data).where(eq(clients.id, id));
  return await getClientById(id);
}

export async function deleteClient(id: number) {
  const db = await requireDb();
  // Clean up related entities first
  await db.delete(transactions).where(eq(transactions.clientId, id));
  await db.delete(clientTools).where(eq(clientTools.clientId, id));
  await db.delete(machines).where(eq(machines.clientId, id));
  await db.delete(clients).where(eq(clients.id, id));
}

export async function listIndustries() {
  const db = await requireDb();
  const rows = await db
    .selectDistinct({ industry: clients.industry })
    .from(clients);
  return rows.map((r) => r.industry).filter((x): x is string => !!x);
}

/**
 * Lean client rows used by the Maps page. Returns every client (including
 * those without coordinates) so the UI can distinguish pending / resolved
 * states and trigger a re-geocode.
 */
export async function listClientsWithCoords() {
  const db = await requireDb();
  // Join with transactions aggregates so the UI can tier clients by
  // order frequency (orders in last 30/60/90/180 days) without an extra round-trip per pin.
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const last90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const last180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      address: clients.address,
      industry: clients.industry,
      activityLevel: clients.activityLevel,
      phone: clients.phone,
      email: clients.email,
      latitude: clients.latitude,
      longitude: clients.longitude,
      geocodeSource: clients.geocodeSource,
      geocodedAt: clients.geocodedAt,
      totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.status} = 'paid' THEN ${transactions.amount} ELSE 0 END), 0)`,
      lastTransactionAt: sql<Date | null>`MAX(${transactions.transactionDate})`,
      transactionCount: sql<number>`COUNT(${transactions.id})`,
      // Order frequency: count transactions in each window
      ordersLast30Days: sql<number>`COUNT(CASE WHEN ${transactions.transactionDate} >= ${last30} THEN 1 END)`,
      ordersLast60Days: sql<number>`COUNT(CASE WHEN ${transactions.transactionDate} >= ${last60} THEN 1 END)`,
      ordersLast90Days: sql<number>`COUNT(CASE WHEN ${transactions.transactionDate} >= ${last90} THEN 1 END)`,
      ordersLast180Days: sql<number>`COUNT(CASE WHEN ${transactions.transactionDate} >= ${last180} THEN 1 END)`,
    })
    .from(clients)
    .leftJoin(transactions, eq(transactions.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(clients.companyName);
  // Drizzle returns SQL aggregates as strings on MySQL; normalize to numbers.
  return rows.map((r) => ({
    ...r,
    totalRevenue: Number(r.totalRevenue ?? 0),
    transactionCount: Number(r.transactionCount ?? 0),
    ordersLast30Days: Number(r.ordersLast30Days ?? 0),
    ordersLast60Days: Number(r.ordersLast60Days ?? 0),
    ordersLast90Days: Number(r.ordersLast90Days ?? 0),
    ordersLast180Days: Number(r.ordersLast180Days ?? 0),
    lastTransactionAt: r.lastTransactionAt ? new Date(r.lastTransactionAt) : null,
  }));
}

export async function setClientCoords(
  id: number,
  coords: { lat: number; lng: number; source: "google" | "manual" | "research" }
) {
  const db = await requireDb();
  await db
    .update(clients)
    .set({
      latitude: coords.lat,
      longitude: coords.lng,
      geocodeSource: coords.source,
      geocodedAt: new Date(),
    })
    .where(eq(clients.id, id));
}

/* ------------------------ Machines ------------------------ */

export async function listMachinesByClient(clientId: number) {
  const db = await requireDb();
  return await db.select().from(machines).where(eq(machines.clientId, clientId)).orderBy(desc(machines.createdAt));
}

export async function createMachine(data: InsertMachine) {
  const db = await requireDb();
  const rows = await db.insert(machines).values(data).returning();
  return rows[0];
}

export async function updateMachine(id: number, data: Partial<InsertMachine>) {
  const db = await requireDb();
  await db.update(machines).set(data).where(eq(machines.id, id));
  const rows = await db.select().from(machines).where(eq(machines.id, id)).limit(1);
  return rows[0];
}

export async function deleteMachine(id: number) {
  const db = await requireDb();
  await db.delete(machines).where(eq(machines.id, id));
}

/* ------------------------ Tools ------------------------ */

export async function listTools() {
  const db = await requireDb();
  return await db.select().from(tools).orderBy(desc(tools.updatedAt));
}

export async function listToolsWithStats(search?: string) {
  const db = await requireDb();
  const like = search ? `%${search}%` : null;
  const whereClause = like
    ? sql`WHERE (t.name LIKE ${like} OR t.sku LIKE ${like} OR t.category LIKE ${like})`
    : sql``;
  const rows = await db.execute(sql`
    SELECT
      t.id,
      t.name,
      t.sku,
      t.category,
      t.unitPrice,
      COUNT(DISTINCT tx.clientId) AS clientCount,
      COALESCE(SUM(tx.quantity), 0) AS totalQty,
      COALESCE(SUM(tx.amount), 0) AS totalRevenue
    FROM tools t
    LEFT JOIN transactions tx ON tx.toolId = t.id
    ${whereClause}
    GROUP BY t.id, t.name, t.sku, t.category, t.unitPrice
    ORDER BY totalRevenue DESC, t.name ASC
    LIMIT 500
  `);
  const data = (rows as any)[0] as Array<{
    id: number;
    name: string;
    sku: string | null;
    category: string | null;
    unitPrice: string | null;
    clientCount: number | string;
    totalQty: number | string;
    totalRevenue: number | string;
  }>;
  return data.map((r) => ({
    id: Number(r.id),
    name: r.name,
    sku: r.sku,
    category: r.category,
    unitPrice: r.unitPrice,
    clientCount: Number(r.clientCount),
    totalQty: Number(r.totalQty),
    totalRevenue: Number(r.totalRevenue),
  }));
}

export async function createTool(data: InsertTool) {
  const db = await requireDb();
  const rows = await db.insert(tools).values(data).returning();
  return rows[0];
}

export async function updateTool(id: number, data: Partial<InsertTool>) {
  const db = await requireDb();
  await db.update(tools).set(data).where(eq(tools.id, id));
  const rows = await db.select().from(tools).where(eq(tools.id, id)).limit(1);
  return rows[0];
}

export async function deleteTool(id: number) {
  const db = await requireDb();
  await db.delete(clientTools).where(eq(clientTools.toolId, id));
  await db.delete(tools).where(eq(tools.id, id));
}

/* ------------------- Client-Tool relationships ------------------- */

export async function listClientTools(clientId: number) {
  const db = await requireDb();
  return await db
    .select({
      id: clientTools.id,
      clientId: clientTools.clientId,
      toolId: clientTools.toolId,
      machineId: clientTools.machineId,
      usageFrequency: clientTools.usageFrequency,
      notes: clientTools.notes,
      createdAt: clientTools.createdAt,
      toolName: tools.name,
      toolCategory: tools.category,
      toolUnitPrice: tools.unitPrice,
      machineType: machines.machineType,
      machineModel: machines.model,
    })
    .from(clientTools)
    .leftJoin(tools, eq(clientTools.toolId, tools.id))
    .leftJoin(machines, eq(clientTools.machineId, machines.id))
    .where(eq(clientTools.clientId, clientId))
    .orderBy(desc(clientTools.createdAt));
}

export async function createClientTool(data: InsertClientTool) {
  const db = await requireDb();
  const rows = await db.insert(clientTools).values(data).returning();
  return { id: rows[0].id };
}

export async function deleteClientTool(id: number) {
  const db = await requireDb();
  await db.delete(clientTools).where(eq(clientTools.id, id));
}

/* ------------------------ Transactions ------------------------ */

export async function listTransactions(filters?: {
  clientId?: number;
  type?: "purchase" | "sharpening";
  status?: "paid" | "pending" | "overdue";
  search?: string;
  limit?: number;
}) {
  const db = await requireDb();
  const conds = [];
  if (filters?.clientId) conds.push(eq(transactions.clientId, filters.clientId));
  if (filters?.type) conds.push(eq(transactions.type, filters.type));
  if (filters?.status) conds.push(eq(transactions.status, filters.status));
  if (filters?.search && filters.search.trim()) {
    // Case-insensitive search matching description OR client name OR invoice number.
    const tokens = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const pattern = `%${tok}%`;
      conds.push(
        sql`(
          LOWER(COALESCE(${transactions.description}, '')) LIKE ${pattern}
          OR LOWER(COALESCE(${transactions.invoiceNumber}, '')) LIKE ${pattern}
          OR LOWER(${clients.companyName}) LIKE ${pattern}
        )`
      );
    }
  }

  const q = db
    .select({
      id: transactions.id,
      clientId: transactions.clientId,
      clientName: clients.companyName,
      type: transactions.type,
      description: transactions.description,
      quantity: transactions.quantity,
      amount: transactions.amount,
      status: transactions.status,
      transactionDate: transactions.transactionDate,
      notes: transactions.notes,
      invoiceNumber: transactions.invoiceNumber,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(transactions.transactionDate));

  const rows = filters?.limit ? await q.limit(filters.limit) : await q;
  return rows;
}

export async function createTransaction(data: InsertTransaction) {
  const db = await requireDb();
  const rows = await db.insert(transactions).values(data).returning();
  return rows[0];
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>) {
  const db = await requireDb();
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return rows[0];
}

export async function deleteTransaction(id: number) {
  const db = await requireDb();
  await db.delete(transactions).where(eq(transactions.id, id));
}

/* ------------------------ Analytics ------------------------ */

export async function getDashboardKpis() {
  const db = await requireDb();

  const totalRevenueRow = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(eq(transactions.status, "paid"));

  const outstandingRow = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(or(eq(transactions.status, "pending"), eq(transactions.status, "overdue")));

  const activeClientsRow = await db
    .select({ c: count() })
    .from(clients);

  // Monthly revenue for current month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthlyRow = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "paid"),
        sql`${transactions.transactionDate} >= ${monthStart}`
      )
    );

  return {
    totalRevenue: Number(totalRevenueRow[0]?.total ?? 0),
    outstanding: Number(outstandingRow[0]?.total ?? 0),
    activeClients: Number(activeClientsRow[0]?.c ?? 0),
    monthlyRevenue: Number(monthlyRow[0]?.total ?? 0),
  };
}

export async function getMonthlyRevenue(monthsBack = 12) {
  const db = await requireDb();
  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const res = await db.execute(sql`
    SELECT
      TO_CHAR(transactionDate, 'YYYY-MM') AS ym,
      type,
      COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE transactionDate >= ${since}
    GROUP BY ym, type
    ORDER BY ym
  `);
  const rows = ((res as any).rows ?? res) as Array<{ ym: string; type: string; total: string | number }>;
  return rows.map((r) => ({
    month: r.ym,
    type: r.type as "purchase" | "sharpening",
    total: Number(r.total ?? 0),
  }));
}

export async function getTopClients(limit = 5) {
  const db = await requireDb();
  const rows = await db
    .select({
      clientId: transactions.clientId,
      clientName: clients.companyName,
      total: sum(transactions.amount),
      txCount: count(),
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .groupBy(transactions.clientId, clients.companyName)
    .orderBy(desc(sql`SUM(${transactions.amount})`))
    .limit(limit);
  return rows.map((r) => ({
    clientId: r.clientId,
    clientName: r.clientName ?? "Unknown",
    total: Number(r.total ?? 0),
    txCount: Number(r.txCount ?? 0),
  }));
}

export async function getClientStats(clientId: number) {
  const db = await requireDb();

  const totalSpendRow = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(eq(transactions.clientId, clientId), eq(transactions.status, "paid")));

  const outstandingRow = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        or(eq(transactions.status, "pending"), eq(transactions.status, "overdue"))
      )
    );

  const sharpeningCountRow = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.quantity}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.clientId, clientId), eq(transactions.type, "sharpening")));

  const monthlyRes = await db.execute(sql`
    SELECT
      TO_CHAR(transactionDate, 'YYYY-MM') AS ym,
      type,
      COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(quantity), 0) AS qty
    FROM transactions
    WHERE clientId = ${clientId}
    GROUP BY ym, type
    ORDER BY ym
  `);
  const monthly = (monthlyRes as any)[0] as Array<{
    ym: string;
    type: string;
    total: string | number;
    qty: string | number;
  }>;

  return {
    totalSpend: Number(totalSpendRow[0]?.total ?? 0),
    outstanding: Number(outstandingRow[0]?.total ?? 0),
    sharpeningCount: Number(sharpeningCountRow[0]?.total ?? 0),
    monthly: monthly.map((m) => ({
      month: m.ym,
      type: m.type as "purchase" | "sharpening",
      total: Number(m.total ?? 0),
      qty: Number(m.qty ?? 0),
    })),
  };
}


/* ---------------------- Dashboard Analytics ---------------------- */

export async function getDashboardKpisV2() {
  // Delegates to the unified KPI helper to guarantee identical numbers in
  // every card/section. See server/financialKpis.ts for the formulas.
  const { getDashboardKpisV2Unified } = await import("./financialKpis");
  return getDashboardKpisV2Unified();
}

export async function getMonthlyRevenueV2(monthsBack: number = 12) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      TO_CHAR(transactionDate, 'YYYY-MM') AS month,
      type,
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*) AS count
    FROM transactions
    WHERE transactionDate >= NOW() - (${monthsBack} * INTERVAL '1 month')
    GROUP BY month, type
    ORDER BY month ASC
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    month: string;
    type: string;
    total: string | number;
    count: number;
  }>;

  return rows.map((r) => ({
    month: r.month,
    type: r.type as "purchase" | "sharpening",
    total: Number(r.total),
    count: r.count,
  }));
}

export async function getClientsWithLastInvoice() {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      c.id,
      c.companyName,
      c.email,
      c.phone,
      c.address,
      c.industry,
      c.activityLevel,
      c.oldestUnpaidDate,
      c.outstandingBalance,
      MAX(t.transactionDate) AS lastInvoiceDate,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE clientId = c.id AND transactionDate >= NOW() - INTERVAL '1 month') AS thisMonthRevenue,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE clientId = c.id) AS totalRevenue,
      (SELECT COUNT(*) FROM transactions WHERE clientId = c.id) AS transactionCount,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE clientId = c.id AND status IN ('pending', 'overdue')) AS outstanding
    FROM clients c
    LEFT JOIN transactions t ON c.id = t.clientId
    GROUP BY c.id
    ORDER BY COALESCE(MAX(t.transactionDate), '1900-01-01') DESC, c.companyName ASC
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    id: number;
    companyName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    industry: string | null;
    activityLevel: string;
    oldestUnpaidDate: Date | null;
    outstandingBalance: string | number | null;
    lastInvoiceDate: Date | null;
    thisMonthRevenue: string | number;
    totalRevenue: string | number;
    transactionCount: number;
    outstanding: string | number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    email: r.email,
    phone: r.phone,
    address: r.address,
    industry: r.industry,
    activityLevel: r.activityLevel,
    oldestUnpaidDate: r.oldestUnpaidDate,
    outstandingBalance: r.outstandingBalance ? Number(r.outstandingBalance) : null,
    lastInvoiceDate: r.lastInvoiceDate,
    thisMonthRevenue: Number(r.thisMonthRevenue),
    totalRevenue: Number(r.totalRevenue),
    transactionCount: r.transactionCount,
    outstanding: Number(r.outstanding),
  }));
}

export async function getTopClientsV2(limit: number = 10) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      c.id AS clientId,
      c.companyName AS clientName,
      COALESCE(SUM(t.amount), 0) AS total,
      COUNT(t.id) AS txCount,
      MAX(t.transactionDate) AS lastTransaction
    FROM clients c
    LEFT JOIN transactions t ON c.id = t.clientId
    GROUP BY c.id, c.companyName
    ORDER BY total DESC
    LIMIT ${limit}
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    clientId: number;
    clientName: string;
    total: string | number;
    txCount: number;
    lastTransaction: Date | null;
  }>;

  return rows.map((r) => ({
    clientId: r.clientId,
    clientName: r.clientName,
    total: Number(r.total),
    txCount: r.txCount,
    lastTransaction: r.lastTransaction,
  }));
}


/* ---------------------- Client Detail ---------------------- */

export async function getClientSpendingAnalysis(clientId: number) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      type,
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*) AS invoiceCount
    FROM transactions
    WHERE clientId = ${clientId}
    GROUP BY type
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    type: string;
    total: string | number;
    invoiceCount: number;
  }>;

  return rows.map((r) => ({
    type: r.type,
    total: Number(r.total),
    invoiceCount: r.invoiceCount,
  }));
}

export async function getClientMachines(clientId: number) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      id,
      machineType,
      brand,
      model,
      serialNumber,
      specifications,
      notes
    FROM machines
    WHERE clientId = ${clientId}
    ORDER BY createdAt DESC
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    id: number;
    machineType: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    specifications: string | null;
    notes: string | null;
  }>;

  return rows;
}

export async function getClientMonthlyTrend(clientId: number, monthsBack: number = 12) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      TO_CHAR(transactionDate, 'YYYY-MM') AS month,
      type,
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*) AS count
    FROM transactions
    WHERE clientId = ${clientId}
      AND transactionDate >= NOW() - (${monthsBack} * INTERVAL '1 month')
    GROUP BY month, type
    ORDER BY month DESC
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    month: string;
    type: string;
    total: string | number;
    count: number;
  }>;

  return rows.map((r) => ({
    month: r.month,
    type: r.type,
    total: Number(r.total),
    count: r.count,
  }));
}


/* ---------------------- Dashboard Analytics ---------------------- */

export async function getOverdueClients() {
  const db = await requireDb();
  const res = await db.execute(sql`
    SELECT
      c.id,
      c.companyName,
      COALESCE(SUM(t.amount), 0) AS outstanding,
      MAX(t.transactionDate) AS lastInvoiceDate,
      EXTRACT(DAY FROM (NOW() - MAX(t.transactionDate))) AS daysOverdue
    FROM clients c
    LEFT JOIN transactions t ON c.id = t.clientId AND t.status IN ('pending', 'overdue')
    GROUP BY c.id, c.companyName
    HAVING outstanding > 0
    ORDER BY daysOverdue DESC
  `);
  
  const rows = ((res as any).rows ?? res) as Array<{
    id: number;
    companyName: string;
    outstanding: string | number;
    lastInvoiceDate: Date | null;
    daysOverdue: number | null;
  }>;
  
  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    outstanding: Number(r.outstanding),
    lastInvoiceDate: r.lastInvoiceDate,
    daysOverdue: r.daysOverdue || 0,
    agingBucket: r.daysOverdue && r.daysOverdue > 60 ? 'critical' : r.daysOverdue && r.daysOverdue > 30 ? 'warning' : 'attention',
  }));
}

export async function getTopPerformers(limit = 10) {
  const db = await requireDb();
  const res = await db.execute(sql`
    SELECT
      c.id,
      c.companyName,
      COALESCE(SUM(t.amount), 0) AS totalRevenue,
      COALESCE(SUM(t.cogs), 0) AS totalCogs,
      COALESCE(SUM(t.amount) - SUM(t.cogs), 0) AS grossProfit,
      CASE 
        WHEN SUM(t.amount) > 0 THEN ROUND(((SUM(t.amount) - SUM(t.cogs)) / SUM(t.amount) * 100), 1)
        ELSE 0
      END AS marginPercent,
      COUNT(*) AS invoiceCount
    FROM clients c
    LEFT JOIN transactions t ON c.id = t.clientId
    GROUP BY c.id, c.companyName
    ORDER BY totalRevenue DESC
    LIMIT ${limit}
  `);
  
  const rows = ((res as any).rows ?? res) as Array<{
    id: number;
    companyName: string;
    totalRevenue: string | number;
    totalCogs: string | number;
    grossProfit: string | number;
    marginPercent: number;
    invoiceCount: number;
  }>;
  
  return rows
    .filter((r) => Number(r.totalRevenue) > 0)
    .map((r) => {
      const totalRevenue = Number(r.totalRevenue);
      const grossProfit = Number(r.grossProfit);
      // Margin as a 0..1 fraction so the frontend can render `(margin * 100).toFixed(1)`.
      const margin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
      return {
        id: r.id,
        // Both keys for forward compatibility with all consumers.
        name: r.companyName,
        companyName: r.companyName,
        totalRevenue,
        totalCogs: Number(r.totalCogs),
        grossProfit,
        margin,
        marginPercent: r.marginPercent,
        invoiceCount: r.invoiceCount,
      };
    });
}

export async function getReceivablesAging() {
  const db = await requireDb();
  const res = await db.execute(sql`
    SELECT
      CASE
        WHEN EXTRACT(DAY FROM (NOW() - transactionDate)) <= 30 THEN '0-30'
        WHEN EXTRACT(DAY FROM (NOW() - transactionDate)) <= 60 THEN '31-60'
        WHEN EXTRACT(DAY FROM (NOW() - transactionDate)) <= 90 THEN '61-90'
        ELSE '90+'
      END AS agingBucket,
      COUNT(*) AS invoiceCount,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount ELSE 0 END), 0) AS outstanding
    FROM transactions
    WHERE status IN ('pending', 'overdue')
    GROUP BY agingBucket
    ORDER BY 
      CASE agingBucket
        WHEN '0-30' THEN 1
        WHEN '31-60' THEN 2
        WHEN '61-90' THEN 3
        ELSE 4
      END
  `);
  
  const rows = ((res as any).rows ?? res) as Array<{
    agingBucket: string;
    invoiceCount: number;
    outstanding: string | number;
  }>;
  
  return rows.map((r) => ({
    agingBucket: r.agingBucket,
    invoiceCount: r.invoiceCount,
    outstanding: Number(r.outstanding),
  }));
}

export async function getQuickStats() {
  // Delegates to the unified KPI helper. Adds avgInvoiceValue + totalInvoices
  // which are unrelated to GP/COGS/Outstanding math.
  const { getFinancialKpis } = await import("./financialKpis");
  const k = await getFinancialKpis();
  const avg = k.invoiceCount > 0 ? k.totalRevenue / k.invoiceCount : 0;
  return {
    totalInvoices: k.invoiceCount,
    avgInvoiceValue: Math.round(avg * 100) / 100,
    totalRevenue: k.totalRevenue,
    totalPaid: k.collected,
    totalOutstanding: k.outstanding,
    collectionRate: k.collectionRate,
  };
}

// Legacy implementation kept for reference — unused after refactor.
async function _getQuickStatsLegacy() {
  const db = await requireDb();
  // Total revenue + invoice stats come from the transactions table.
  const txRes = await db.execute(sql`
    SELECT
      COUNT(DISTINCT invoiceNumber) AS totalInvoices,
      COALESCE(AVG(amount), 0) AS avgInvoiceValue,
      COALESCE(SUM(amount), 0) AS totalRevenue
    FROM transactions
  `);
  // Outstanding is the source-of-truth figure imported from Client_Balances.
  // Per-row transaction.status doesn't track payments, so we cannot derive it.
  const obRes = await db.execute(sql`
    SELECT COALESCE(SUM(outstandingBalance), 0) AS totalOutstanding
    FROM clients
  `);

  const txRows = (txRes as any)[0] as Array<{
    totalInvoices: number;
    avgInvoiceValue: string | number;
    totalRevenue: string | number;
  }>;
  const obRows = (obRes as any)[0] as Array<{ totalOutstanding: string | number }>;

  if (txRows.length === 0) {
    return {
      totalInvoices: 0,
      avgInvoiceValue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      collectionRate: 0,
    };
  }

  const t = txRows[0];
  const totalRevenue = Number(t.totalRevenue);
  const totalOutstanding = Math.max(0, Number(obRows[0]?.totalOutstanding ?? 0));
  // Cap collected at totalRevenue — if outstanding ever exceeds revenue (e.g.
  // historical receivables carried over from a prior period), collected
  // shouldn't go negative.
  const totalPaid = Math.max(0, totalRevenue - totalOutstanding);
  // Collection Rate = (Revenue − Outstanding) / Revenue × 100, clamped to [0, 100].
  const rawRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
  const collectionRate = Math.max(0, Math.min(100, Math.round(rawRate)));

  return {
    totalInvoices: t.totalInvoices,
    avgInvoiceValue: Number(t.avgInvoiceValue),
    totalRevenue,
    totalPaid,
    totalOutstanding,
    collectionRate,
  };
}

export async function getProfitabilityTrend(monthsBack = 12) {
  const db = await requireDb();
  const res = await db.execute(sql`
    SELECT
      TO_CHAR(transactionDate, 'YYYY-MM') AS month,
      COALESCE(SUM(amount), 0) AS revenue,
      COALESCE(SUM(cogs), 0) AS cogs,
      COALESCE(SUM(amount) - SUM(cogs), 0) AS grossProfit,
      CASE 
        WHEN SUM(amount) > 0 THEN ROUND(((SUM(amount) - SUM(cogs)) / SUM(amount) * 100), 1)
        ELSE 0
      END AS marginPercent
    FROM transactions
    WHERE transactionDate >= NOW() - (${monthsBack} * INTERVAL '1 month')
    GROUP BY month
    ORDER BY month ASC
  `);
  
  const rows = ((res as any).rows ?? res) as Array<{
    month: string;
    revenue: string | number;
    cogs: string | number;
    grossProfit: string | number;
    marginPercent: number;
  }>;
  
  return rows.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    cogs: Number(r.cogs),
    grossProfit: Number(r.grossProfit),
    marginPercent: r.marginPercent,
  }));
}

export async function getTransactionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.clientId, clientId))
    .orderBy(desc(transactions.transactionDate));
}

/* ---------------------- Outstanding/Receivables ---------------------- */

export async function getTotalOutstanding() {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({
      total: sql<number>`CAST(SUM(CAST(${clients.outstandingBalance} AS DECIMAL(12,2))) AS DECIMAL(12,2))`
    })
    .from(clients)
    .where(and(
      isNotNull(clients.outstandingBalance),
      ne(clients.outstandingBalance, '0')
    ));
  
  return Number(result[0]?.total || 0);
}

export async function getClientsWithOutstanding() {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      id: clients.id,
      excelClientId: clients.excelClientId,
      companyName: clients.companyName,
      outstandingBalance: clients.outstandingBalance,
      oldestUnpaidDate: clients.oldestUnpaidDate,
    })
    .from(clients)
    .where(and(
      isNotNull(clients.outstandingBalance),
      gt(sql<number>`CAST(${clients.outstandingBalance} AS DECIMAL(12,2))`, 0)
    ))
    .orderBy(desc(clients.outstandingBalance));
}

// ============================================================================
// Stock History — purchase-history lookups by client + flexible item search
// ----------------------------------------------------------------------------
// All helpers below operate on `transactions` rows where `type = 'purchase'`
// (i.e. the Fact Sales sheet). The "item" identifier is the transaction
// `description` field, which is the raw item code/name from the Excel sheet.
// Unit price is computed as `amount / quantity` per row.
// ============================================================================

/** Search clients by name (case-insensitive substring) — returns top N matches with purchase counts. */
export async function searchClientsForStockHistory(query: string, limit: number = 25) {
  const db = await getDb();
  if (!db) return [];
  const q = (query ?? "").trim().toLowerCase();
  const like = `%${q}%`;
  const res = await db.execute(sql`
    SELECT
      c.id,
      c.companyName,
      c.excelClientId,
      COUNT(t.id) AS purchaseCount,
      COALESCE(SUM(CASE WHEN t.type='purchase' THEN t.amount ELSE 0 END), 0) AS totalPurchased,
      MAX(CASE WHEN t.type='purchase' THEN t.transactionDate END) AS lastPurchaseDate
    FROM clients c
    LEFT JOIN transactions t ON t.clientId = c.id AND t.type='purchase'
    WHERE (${q === ""} OR LOWER(c.companyName) LIKE ${like})
    GROUP BY c.id, c.companyName, c.excelClientId
    HAVING COUNT(t.id) > 0 OR ${q === ""}
    ORDER BY purchaseCount DESC, c.companyName ASC
    LIMIT ${limit}
  `);
  return ((res as any).rows ?? res) as Array<{
    id: number;
    companyName: string;
    excelClientId: number | null;
    purchaseCount: number;
    totalPurchased: string;
    lastPurchaseDate: Date | null;
  }>;
}

/**
 * List distinct items purchased by a given client, with aggregate stats.
 *
 * Universal search: the optional `search` string is split into whitespace-separated
 * tokens. Every token must appear (case-insensitive substring) in the haystack, where
 * the haystack is the concatenation of:
 *   - the transaction's item code/name/description (`transactions.description`)
 *   - the linked tool's name, description and category (when `transactions.toolId` is set)
 *   - the linked tool's id (so you can search by item ID)
 *
 * This means typing "mar", "200", "3072" or any combination like "mar 3072 ATB" all
 * surface the same matching items (every token must match somewhere in the haystack).
 */
export async function getItemsByClient(clientId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const tokens = (search ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Build the per-token LIKE clauses dynamically. Each token must match the haystack.
  // Haystack = COALESCE(tx_desc, '') ||' '|| COALESCE(tool.name,'') ||' '|| COALESCE(tool.description,'') ||' '|| COALESCE(tool.category,'') ||' '|| COALESCE(CAST(tool.id AS CHAR),'') ||' '|| COALESCE(CAST(tx.toolId AS CHAR),'')
  const haystack = sql`LOWER(CONCAT_WS(' ',
      COALESCE(t.itemId, ''),
      COALESCE(t.description, ''),
      COALESCE(tl.name, ''),
      COALESCE(tl.description, ''),
      COALESCE(tl.category, ''),
      COALESCE(CAST(tl.id AS CHAR), ''),
      COALESCE(CAST(t.toolId AS CHAR), '')
    ))`;

  const tokenClauses =
    tokens.length === 0
      ? sql`1=1`
      : sql.join(
          tokens.map((tok) => sql`${haystack} LIKE ${"%" + tok + "%"}`),
          sql` AND `
        );

  const res = await db.execute(sql`
    SELECT
      t.description AS itemName,
      MAX(t.itemId) AS factItemId,
      MAX(t.toolId) AS toolId,
      MAX(tl.name) AS toolName,
      MAX(tl.description) AS toolDescription,
      MAX(tl.category) AS toolCategory,
      COUNT(*) AS purchaseCount,
      SUM(t.quantity) AS totalQuantity,
      SUM(t.amount) AS totalSpent,
      MAX(t.transactionDate) AS lastPurchaseDate,
      MIN(t.transactionDate) AS firstPurchaseDate,
      -- Most recent unit price for this item
      (SELECT t2.amount / NULLIF(t2.quantity, 0)
       FROM transactions t2
       WHERE t2.clientId = ${clientId}
         AND t2.type = 'purchase'
         AND t2.description = t.description
       ORDER BY t2.transactionDate DESC, t2.id DESC
       LIMIT 1) AS lastUnitPrice,
      -- Average unit price over all purchases of this item
      AVG(t.amount / NULLIF(t.quantity, 0)) AS avgUnitPrice
    FROM transactions t
    LEFT JOIN tools tl ON tl.id = t.toolId
    WHERE t.clientId = ${clientId}
      AND t.type = 'purchase'
      AND (${tokenClauses})
    GROUP BY t.description
    ORDER BY lastPurchaseDate DESC, totalSpent DESC
  `);
  return ((res as any).rows ?? res) as Array<{
    itemName: string;
    factItemId: string | null;
    toolId: number | null;
    toolName: string | null;
    toolDescription: string | null;
    toolCategory: string | null;
    purchaseCount: number;
    totalQuantity: number;
    totalSpent: string;
    lastPurchaseDate: Date;
    firstPurchaseDate: Date;
    lastUnitPrice: string;
    avgUnitPrice: string;
  }>;
}

/** Full purchase history of a single (client, item) pair — every Fact Sales row, newest first. */
export async function getItemPurchaseHistory(clientId: number, itemName: string) {
  const db = await getDb();
  if (!db) return [];
  const res = await db.execute(sql`
    SELECT
      t.id,
      t.description AS itemName,
      t.quantity,
      t.amount,
      (t.amount / NULLIF(t.quantity, 0)) AS unitPrice,
      t.transactionDate,
      t.invoiceNumber,
      t.status
    FROM transactions t
    WHERE t.clientId = ${clientId}
      AND t.type = 'purchase'
      AND t.description = ${itemName}
    ORDER BY t.transactionDate DESC, t.id DESC
  `);
  return ((res as any).rows ?? res) as Array<{
    id: number;
    itemName: string;
    quantity: number;
    amount: string;
    unitPrice: string;
    transactionDate: Date;
    invoiceNumber: string | null;
    status: string;
  }>;
}


// =====================================================================
// Operating Costs (sourced from Fact_Cost, classification done at import)
// =====================================================================

/**
 * High-level Operating Cost summary for the Operating Cost page and the
 * Dashboard Net Profit widget.
 *
 * Returns:
 *   - totalOperating: sum(amount) WHERE classification='operating'
 *   - totalInventory / totalShipping: for traceability (NOT included in operating)
 *   - byCategory: each operating bucket with its total
 *   - byMonth: month-by-month operating totals (UTC, ISO month string YYYY-MM)
 *   - byCategoryByMonth: full pivot — { category: { 'YYYY-MM': total } }
 *   - rowCount: number of operating-cost rows
 */
export async function getOperatingCostSummary() {
  const d = await getDb();
  if (!d) {
    return {
      totalOperating: 0,
      totalInventory: 0,
      totalShipping: 0,
      rowCount: 0,
      byCategory: [] as { category: string; total: number; count: number }[],
      byMonth: [] as { month: string; total: number; count: number }[],
      byCategoryByMonth: {} as Record<string, Record<string, number>>,
      months: [] as string[],
    };
  }

  // Totals by classification (1 row per classification)
  const byCls = await d.execute(sql`
    SELECT classification, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
    FROM operatingCosts
    GROUP BY classification
  `);
  const clsRows = (byCls as unknown as [Array<{ classification: string; total: string | number; cnt: number }>])[0];
  let totalOperating = 0,
    totalInventory = 0,
    totalShipping = 0;
  let rowCount = 0;
  for (const r of clsRows) {
    const t = Number(r.total);
    if (r.classification === "operating") {
      totalOperating = t;
      rowCount = Number(r.cnt);
    } else if (r.classification === "inventory") totalInventory = t;
    else if (r.classification === "shipping") totalShipping = t;
  }

  // Operating only — by category
  const byCatRes = await d.execute(sql`
    SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
    FROM operatingCosts
    WHERE classification = 'operating'
    GROUP BY category
    ORDER BY total DESC
  `);
  const byCatRows = (byCatRes as unknown as [Array<{ category: string; total: string | number; cnt: number }>])[0];
  const byCategory = byCatRows.map((r) => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.cnt),
  }));

  // Operating only — by month (UTC)
  const byMonthRes = await d.execute(sql`
    SELECT TO_CHAR(txDate, 'YYYY-MM') AS month,
           COALESCE(SUM(amount),0) AS total,
           COUNT(*) AS cnt
    FROM operatingCosts
    WHERE classification = 'operating'
    GROUP BY month
    ORDER BY month ASC
  `);
  const byMonthRows = (byMonthRes as unknown as [Array<{ month: string; total: string | number; cnt: number }>])[0];
  const byMonth = byMonthRows.map((r) => ({
    month: r.month,
    total: Number(r.total),
    count: Number(r.cnt),
  }));

  // Pivot: category × month
  const pivotRes = await d.execute(sql`
    SELECT category,
           TO_CHAR(txDate, 'YYYY-MM') AS month,
           COALESCE(SUM(amount),0) AS total
    FROM operatingCosts
    WHERE classification = 'operating'
    GROUP BY category, month
    ORDER BY month ASC
  `);
  const pivotRows = (pivotRes as unknown as [Array<{ category: string; month: string; total: string | number }>])[0];
  const byCategoryByMonth: Record<string, Record<string, number>> = {};
  const monthSet = new Set<string>();
  for (const r of pivotRows) {
    monthSet.add(r.month);
    if (!byCategoryByMonth[r.category]) byCategoryByMonth[r.category] = {};
    byCategoryByMonth[r.category][r.month] = Number(r.total);
  }
  const months = Array.from(monthSet).sort();

  return {
    totalOperating,
    totalInventory,
    totalShipping,
    rowCount,
    byCategory,
    byMonth,
    byCategoryByMonth,
    months,
  };
}

/**
 * List individual operating-cost rows with filters (for the drilldown table
 * inside the Operating Cost page).
 */
export async function listOperatingCostRows(filters?: {
  category?: string;
  month?: string; // 'YYYY-MM'
  search?: string;
  limit?: number;
}): Promise<OperatingCost[]> {
  const d = await getDb();
  if (!d) return [];
  const where: SQL[] = [eq(operatingCosts.classification, "operating")];
  if (filters?.category) {
    where.push(eq(operatingCosts.category, filters.category as OperatingCost["category"]));
  }
  if (filters?.month) {
    where.push(sql`TO_CHAR(${operatingCosts.txDate}, 'YYYY-MM') = ${filters.month}`);
  }
  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    where.push(
      or(
        like(operatingCosts.expenseAccount, q),
        like(operatingCosts.description, q),
        like(operatingCosts.payee, q),
        like(operatingCosts.rawCostType, q),
      )!,
    );
  }
  const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 1000);
  const rows = await d
    .select()
    .from(operatingCosts)
    .where(and(...where))
    .orderBy(desc(operatingCosts.txDate))
    .limit(limit);
  return rows;
}

/**
 * Net Profit feed for the Dashboard. Pairs revenue/gross-profit numbers (from
 * existing kpi helpers) with operating cost so the Dashboard can render
 * Total Revenue / Gross Profit / Operating Cost / Net Profit consistently.
 */
export async function getNetProfitFeed() {
  // Delegates to the unified KPI helper.
  const { getFinancialKpis } = await import("./financialKpis");
  const k = await getFinancialKpis();
  return {
    totalRevenue: k.totalRevenue,
    toolsRevenue: k.toolsRevenue,
    sharpeningRevenue: k.sharpeningRevenue,
    toolsCogs: k.toolsCogs,
    grossProfit: k.grossProfit,
    grossMargin: k.grossMargin,
    operatingCost: k.operatingCost,
    netProfit: k.netProfit,
    netMargin: k.netMargin,
  };
}


/**
 * Period-aware Dashboard KPIs. When `month` is provided (1-12), the totals
 * are scoped to that calendar month of the given year. When only `year` is
 * provided, all 12 months of that year are summed. When neither is provided,
 * the result is all-time.
 *
 * Returns Total Revenue, Tools/Sharpening split, COGS, Gross Profit (= Revenue
 * − COGS), Operating Cost (operating-classification only), Net Profit
 * (= Gross Profit − Operating Cost), Outstanding (always all-time as it is a
 * point-in-time figure), invoice + transaction counts, and a list of years
 * available in the dataset for the UI selector.
 */
export async function getDashboardByPeriod(filter?: { year?: number; month?: number }) {
  // Delegates to the unified KPI helper for ALL math — guarantees the same
  // GP/COGS/NetProfit numbers as the Dashboard hero, the P&L card, and any
  // export. Outstanding remains a point-in-time figure (always all-time).
  const { getFinancialKpis } = await import("./financialKpis");
  const k = await getFinancialKpis({ year: filter?.year, month: filter?.month });
  return {
    year: k.year,
    month: k.month,
    totalRevenue: k.totalRevenue,
    toolsRevenue: k.toolsRevenue,
    sharpeningRevenue: k.sharpeningRevenue,
    totalCogs: k.totalCogs,
    grossProfit: k.grossProfit,
    grossMargin: k.grossMargin,
    operatingCost: k.operatingCost,
    netProfit: k.netProfit,
    netMargin: k.netMargin,
    outstanding: k.outstanding,
    transactionCount: k.transactionCount,
    invoiceCount: k.invoiceCount,
    availableYears: k.availableYears,
  };
}

// Legacy implementation kept below (unused) for reference — will be removed in
// a follow-up cleanup once we have one full release confirming the unified
// path is healthy.
async function _getDashboardByPeriodLegacy(filter?: { year?: number; month?: number }) {
  const d = await getDb();
  if (!d) {
    return {
      year: filter?.year ?? null,
      month: filter?.month ?? null,
      totalRevenue: 0,
      toolsRevenue: 0,
      sharpeningRevenue: 0,
      totalCogs: 0,
      grossProfit: 0,
      grossMargin: 0,
      operatingCost: 0,
      netProfit: 0,
      netMargin: 0,
      outstanding: 0,
      transactionCount: 0,
      invoiceCount: 0,
      availableYears: [] as number[],
    };
  }

  // Build a date filter clause for transactions/operatingCosts
  const yearFilter = filter?.year && filter.year > 0 ? filter.year : null;
  const monthFilter = filter?.month && filter.month >= 1 && filter.month <= 12 ? filter.month : null;

  const txWhere: SQL[] = [];
  if (yearFilter !== null) txWhere.push(sql`EXTRACT(YEAR FROM transactionDate) = ${yearFilter}`);
  if (monthFilter !== null) txWhere.push(sql`EXTRACT(MONTH FROM transactionDate) = ${monthFilter}`);
  const txWhereClause = txWhere.length > 0 ? sql.join([sql`WHERE `, sql.join(txWhere, sql` AND `)]) : sql``;

  const ocWhere: SQL[] = [sql`classification = 'operating'`];
  if (yearFilter !== null) ocWhere.push(sql`EXTRACT(YEAR FROM txDate) = ${yearFilter}`);
  if (monthFilter !== null) ocWhere.push(sql`EXTRACT(MONTH FROM txDate) = ${monthFilter}`);
  const ocWhereClause = sql.join([sql`WHERE `, sql.join(ocWhere, sql` AND `)]);

  // Revenue + COGS by type
  const txRes = await d.execute(sql`
    SELECT type,
           COALESCE(SUM(amount), 0) AS revenue,
           COALESCE(SUM(cogs), 0) AS cogs,
           COUNT(*) AS cnt,
           COUNT(DISTINCT invoiceNumber) AS invoiceCnt
    FROM transactions
    ${txWhereClause}
    GROUP BY type
  `);
  const txRows = (txRes as unknown as [Array<{ type: string; revenue: string | number; cogs: string | number; cnt: number; invoiceCnt: number }>])[0];
  let toolsRevenue = 0,
    sharpeningRevenue = 0,
    totalCogs = 0,
    transactionCount = 0;
  const invoiceSetCounts: number[] = [];
  for (const r of txRows) {
    const rev = Number(r.revenue);
    const cogs = Number(r.cogs);
    const cnt = Number(r.cnt);
    if (r.type === "purchase" || r.type === "tool" || r.type === "tools") toolsRevenue += rev;
    else if (r.type === "sharpening") sharpeningRevenue += rev;
    totalCogs += cogs;
    transactionCount += cnt;
    invoiceSetCounts.push(Number(r.invoiceCnt));
  }
  const totalRevenue = toolsRevenue + sharpeningRevenue;
  const grossProfit = totalRevenue - totalCogs;
  const grossMargin = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // Distinct invoice count over the period
  const invRes = await d.execute(sql`
    SELECT COUNT(DISTINCT invoiceNumber) AS cnt
    FROM transactions
    ${txWhereClause}
  `);
  const invRows = (invRes as unknown as [Array<{ cnt: number }>])[0];
  const invoiceCount = invRows.length > 0 ? Number(invRows[0]!.cnt) : 0;

  // Operating cost over the period
  const opRes = await d.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM operatingCosts
    ${ocWhereClause}
  `);
  const opRows = (opRes as unknown as [Array<{ total: string | number }>])[0];
  const operatingCost = opRows.length > 0 ? Number(opRows[0]!.total) : 0;
  const netProfit = grossProfit - operatingCost;
  const netMargin = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // Outstanding is point-in-time; always all-time
  const outRes = await d.execute(sql`
    SELECT COALESCE(SUM(CAST(outstandingBalance AS DECIMAL(14,2))), 0) AS total
    FROM clients
  `);
  const outRows = (outRes as unknown as [Array<{ total: string | number }>])[0];
  const outstanding = outRows.length > 0 ? Number(outRows[0]!.total) : 0;

  // Years available in the dataset (transactions ∪ operatingCosts)
  const yearsRes = await d.execute(sql`
    SELECT DISTINCT EXTRACT(YEAR FROM transactionDate) AS y FROM transactions WHERE transactionDate IS NOT NULL
    UNION
    SELECT DISTINCT EXTRACT(YEAR FROM txDate) AS y FROM operatingCosts WHERE txDate IS NOT NULL
    ORDER BY y ASC
  `);
  const yearsRows = (yearsRes as unknown as [Array<{ y: number }>])[0];
  const availableYears = yearsRows.map((r) => Number(r.y)).filter((y) => y > 0);

  return {
    year: yearFilter,
    month: monthFilter,
    totalRevenue,
    toolsRevenue,
    sharpeningRevenue,
    totalCogs,
    grossProfit,
    grossMargin,
    operatingCost,
    netProfit,
    netMargin,
    outstanding,
    transactionCount,
    invoiceCount,
    availableYears,
  };
}


/* -------------------------------------------------------------------------- */
/* SKU Velocity & Reorder Watch                                                */
/* -------------------------------------------------------------------------- */

/**
 * For every tool that has at least one purchase transaction, returns velocity
 * KPIs (units sold in last 30/90/365 days, last-sold-at, lifetime revenue,
 * margin) plus two heuristic tags: `velocityTag` and `reorderTag`.
 *
 *  - velocityTag:
 *      "fast"   = sold in last 30 days, >= 3 units in last 90d
 *      "steady" = sold in last 90 days, < 3 units in last 90d
 *      "slow"   = sold in last 365 days but not in last 90d
 *      "dead"   = no sale in last 365 days
 *
 *  - reorderTag:
 *      "reorder-now" = fast mover with <= 1 unit "in stock" assumption
 *      "watch"       = steady mover, last sold > 60 days ago
 *      "ok"          = everything else
 *
 * The function reads from the `transactions` table (type='purchase') and the
 * `tools` table only, so it is read-only and safe to call on every dashboard
 * mount.
 */
export async function getSkuVelocity(opts?: { limit?: number }) {
  const db = await requireDb();
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 200));
  const res = await db.execute(sql`
    SELECT
      t.id AS toolId,
      t.name AS toolName,
      t.category AS toolCategory,
      t.unitPrice AS unitPrice,
      COUNT(tx.id) AS lifetimeUnits,
      COALESCE(SUM(tx.amount), 0) AS lifetimeRevenue,
      COALESCE(SUM(tx.cogs), 0) AS lifetimeCogs,
      COALESCE(SUM(CASE WHEN tx.transactionDate >= (NOW() - INTERVAL '30 days') THEN tx.quantity ELSE 0 END), 0) AS units30d,
      COALESCE(SUM(CASE WHEN tx.transactionDate >= (NOW() - INTERVAL '90 days') THEN tx.quantity ELSE 0 END), 0) AS units90d,
      COALESCE(SUM(CASE WHEN tx.transactionDate >= (NOW() - INTERVAL '365 days') THEN tx.quantity ELSE 0 END), 0) AS units365d,
      COALESCE(SUM(CASE WHEN tx.transactionDate >= (NOW() - INTERVAL '30 days') THEN tx.amount ELSE 0 END), 0) AS revenue30d,
      COALESCE(SUM(CASE WHEN tx.transactionDate >= (NOW() - INTERVAL '90 days') THEN tx.amount ELSE 0 END), 0) AS revenue90d,
      MAX(tx.transactionDate) AS lastSoldAt
    FROM tools t
    LEFT JOIN transactions tx
      ON tx.toolId = t.id AND tx.type = 'purchase'
    GROUP BY t.id, t.name, t.category, t.unitPrice
    HAVING lifetimeUnits > 0
    ORDER BY revenue90d DESC, lifetimeRevenue DESC
    LIMIT ${limit}
  `);
  const rows = ((res as any).rows ?? res) as Array<{
    toolId: number;
    toolName: string;
    toolCategory: string | null;
    unitPrice: string | number | null;
    lifetimeUnits: number;
    lifetimeRevenue: string | number;
    lifetimeCogs: string | number;
    units30d: number;
    units90d: number;
    units365d: number;
    revenue30d: string | number;
    revenue90d: string | number;
    lastSoldAt: string | Date | null;
  }>;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  return rows.map((r) => {
    const lifetimeRevenue = Number(r.lifetimeRevenue);
    const lifetimeCogs = Number(r.lifetimeCogs);
    const grossProfit = lifetimeRevenue - lifetimeCogs;
    const marginPct =
      lifetimeRevenue > 0 ? Number(((grossProfit / lifetimeRevenue) * 100).toFixed(1)) : 0;

    const lastSoldAt = r.lastSoldAt ? new Date(r.lastSoldAt as any) : null;
    const daysSinceLastSale = lastSoldAt
      ? Math.max(0, Math.floor((now - lastSoldAt.getTime()) / DAY))
      : Number.POSITIVE_INFINITY;

    const units30 = Number(r.units30d);
    const units90 = Number(r.units90d);
    const units365 = Number(r.units365d);

    let velocityTag: "fast" | "steady" | "slow" | "dead" = "dead";
    if (units30 > 0 && units90 >= 3) velocityTag = "fast";
    else if (units90 > 0) velocityTag = "steady";
    else if (units365 > 0) velocityTag = "slow";

    let reorderTag: "reorder-now" | "watch" | "ok" = "ok";
    if (velocityTag === "fast") reorderTag = "reorder-now";
    else if (velocityTag === "steady" && daysSinceLastSale > 60) reorderTag = "watch";

    return {
      toolId: r.toolId,
      toolName: r.toolName,
      toolCategory: r.toolCategory ?? null,
      unitPrice: r.unitPrice == null ? null : Number(r.unitPrice),
      lifetimeUnits: Number(r.lifetimeUnits),
      lifetimeRevenue,
      lifetimeCogs,
      grossProfit,
      marginPct,
      units30d: units30,
      units90d: units90,
      units365d: units365,
      revenue30d: Number(r.revenue30d),
      revenue90d: Number(r.revenue90d),
      lastSoldAt: lastSoldAt ? lastSoldAt.toISOString() : null,
      daysSinceLastSale: Number.isFinite(daysSinceLastSale)
        ? (daysSinceLastSale as number)
        : null,
      velocityTag,
      reorderTag,
    };
  });
}

/**
 * Aggregated summary for the Inventory Intelligence dashboard card.
 * Combines the SKU velocity rows into top movers, reorder list, dead stock,
 * plus the sharpening services leaderboard and an overall margin comparison
 * (sharpening vs tools).
 */
export async function getInventoryIntelligence() {
  const allSkus = await getSkuVelocity({ limit: 500 });

  const topMovers = [...allSkus]
    .filter((s) => s.velocityTag === "fast" || s.velocityTag === "steady")
    .sort((a, b) => b.revenue90d - a.revenue90d || b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  const reorderList = allSkus
    .filter((s) => s.reorderTag === "reorder-now")
    .sort((a, b) => b.units90d - a.units90d || b.revenue90d - a.revenue90d)
    .slice(0, 5);

  const deadStock = allSkus
    .filter((s) => s.velocityTag === "dead")
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  const watchList = allSkus
    .filter((s) => s.reorderTag === "watch")
    .sort((a, b) => (a.daysSinceLastSale ?? 0) - (b.daysSinceLastSale ?? 0))
    .slice(0, 5);

  // Sharpening services leaderboard (line items grouped by description).
  const db = await requireDb();
  const sharpRes = await db.execute(sql`
    SELECT
      COALESCE(t.name, tx.description, 'Sharpening service') AS serviceName,
      COUNT(tx.id) AS jobs,
      COALESCE(SUM(tx.quantity), 0) AS totalQty,
      COALESCE(SUM(tx.amount), 0) AS revenue,
      COALESCE(SUM(tx.cogs), 0) AS cogs,
      MAX(tx.transactionDate) AS lastJobAt
    FROM transactions tx
    LEFT JOIN tools t ON t.id = tx.toolId
    WHERE tx.type = 'sharpening'
    GROUP BY serviceName
    ORDER BY revenue DESC
    LIMIT 5
  `);
  const sharpRows = (sharpRes as any)[0] as Array<{
    serviceName: string;
    jobs: number;
    totalQty: number;
    revenue: string | number;
    cogs: string | number;
    lastJobAt: string | Date | null;
  }>;
  const topSharpening = sharpRows.map((r) => {
    const revenue = Number(r.revenue);
    const cogs = Number(r.cogs);
    const grossProfit = revenue - cogs;
    const marginPct = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0;
    return {
      serviceName: r.serviceName,
      jobs: Number(r.jobs),
      totalQty: Number(r.totalQty),
      revenue,
      cogs,
      grossProfit,
      marginPct,
      lastJobAt: r.lastJobAt ? new Date(r.lastJobAt as any).toISOString() : null,
    };
  });

  // Overall stream margin comparison (so the user can see sharpening margin vs tools).
  const compRes = await db.execute(sql`
    SELECT
      type,
      COALESCE(SUM(amount), 0) AS revenue,
      COALESCE(SUM(cogs), 0) AS cogs
    FROM transactions
    GROUP BY type
  `);
  const compRows = (compRes as any)[0] as Array<{
    type: string;
    revenue: string | number;
    cogs: string | number;
  }>;
  const streamMargins = compRows.map((r) => {
    const revenue = Number(r.revenue);
    const cogs = Number(r.cogs);
    const grossProfit = revenue - cogs;
    const marginPct = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0;
    return { type: r.type, revenue, cogs, grossProfit, marginPct };
  });

  // Headline numbers.
  const totalSkusSoldEver = allSkus.length;
  const fastMovers = allSkus.filter((s) => s.velocityTag === "fast").length;
  const deadStockCount = allSkus.filter((s) => s.velocityTag === "dead").length;
  const deadStockRevenueLifetime = allSkus
    .filter((s) => s.velocityTag === "dead")
    .reduce((sum, s) => sum + s.lifetimeRevenue, 0);

  return {
    totalSkusSoldEver,
    fastMovers,
    deadStockCount,
    deadStockRevenueLifetime,
    topMovers,
    reorderList,
    watchList,
    deadStock,
    topSharpening,
    streamMargins,
  };
}


// =====================================================================
// Invoice Explorer — per-invoice P&L breakdown
// =====================================================================

/**
 * Search invoices by invoice number (substring, case-insensitive).
 * Returns a summary per invoice: client name, date, total revenue, total COGS,
 * gross profit, markup %, margin %, line item count.
 */
export async function searchInvoices(query: string, opts?: { limit?: number }) {
  const db = await requireDb();
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 500));
  const q = (query ?? "").trim().toLowerCase();
  const like = `%${q}%`;

  const res = await db.execute(sql`
    SELECT
      t.invoiceNumber,
      t.clientId,
      c.companyName AS clientName,
      t.type,
      MIN(t.transactionDate) AS invoiceDate,
      COUNT(*) AS lineItems,
      COALESCE(SUM(CAST(t.amount AS DECIMAL(12,2))), 0) AS totalRevenue,
      COALESCE(SUM(CAST(t.cogs AS DECIMAL(12,2))), 0) AS totalCogs
    FROM transactions t
    LEFT JOIN clients c ON c.id = t.clientId
    WHERE t.invoiceNumber IS NOT NULL
      AND t.invoiceNumber != ''
      AND (${q === ""} OR LOWER(t.invoiceNumber) LIKE ${like})
    GROUP BY t.invoiceNumber, t.clientId, c.companyName, t.type
    ORDER BY invoiceDate DESC, totalRevenue DESC
    LIMIT ${limit}
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    invoiceNumber: string;
    clientId: number;
    clientName: string | null;
    type: string;
    invoiceDate: Date;
    lineItems: number;
    totalRevenue: string | number;
    totalCogs: string | number;
  }>;

  return rows.map((r) => {
    const revenue = Number(r.totalRevenue);
    const cogs = Number(r.totalCogs);
    const grossProfit = revenue - cogs;
    const marginPct = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0;
    const markupPct = cogs > 0 ? Number(((grossProfit / cogs) * 100).toFixed(1)) : (revenue > 0 ? 100 : 0);
    return {
      invoiceNumber: r.invoiceNumber,
      clientId: r.clientId,
      clientName: r.clientName ?? "Unknown",
      type: r.type,
      invoiceDate: r.invoiceDate,
      lineItems: Number(r.lineItems),
      totalRevenue: revenue,
      totalCogs: cogs,
      grossProfit,
      marginPct,
      markupPct,
    };
  });
}

/**
 * Get full line-item detail for a specific invoice number.
 * Returns every transaction row for that invoice with per-line P&L.
 */
export async function getInvoiceDetail(invoiceNumber: string) {
  const db = await requireDb();

  const res = await db.execute(sql`
    SELECT
      t.id,
      t.invoiceNumber,
      t.clientId,
      c.companyName AS clientName,
      t.type,
      t.description,
      t.itemId,
      t.quantity,
      CAST(t.amount AS DECIMAL(12,2)) AS amount,
      CAST(t.cogs AS DECIMAL(12,2)) AS cogs,
      t.transactionDate,
      t.status,
      tl.name AS toolName,
      tl.category AS toolCategory
    FROM transactions t
    LEFT JOIN clients c ON c.id = t.clientId
    LEFT JOIN tools tl ON tl.id = t.toolId
    WHERE t.invoiceNumber = ${invoiceNumber}
    ORDER BY t.amount DESC, t.id ASC
  `);

  const rows = ((res as any).rows ?? res) as Array<{
    id: number;
    invoiceNumber: string;
    clientId: number;
    clientName: string | null;
    type: string;
    description: string;
    itemId: string | null;
    quantity: number;
    amount: string | number;
    cogs: string | number;
    transactionDate: Date;
    status: string;
    toolName: string | null;
    toolCategory: string | null;
  }>;

  if (rows.length === 0) return null;

  // Compute per-line P&L
  const lineItems = rows.map((r) => {
    const amount = Number(r.amount);
    const cogs = Number(r.cogs);
    const grossProfit = amount - cogs;
    const marginPct = amount > 0 ? Number(((grossProfit / amount) * 100).toFixed(1)) : 0;
    const markupPct = cogs > 0 ? Number(((grossProfit / cogs) * 100).toFixed(1)) : (amount > 0 ? 100 : 0);
    const unitPrice = r.quantity > 0 ? Number((amount / r.quantity).toFixed(2)) : amount;
    const unitCost = r.quantity > 0 ? Number((cogs / r.quantity).toFixed(2)) : cogs;
    return {
      id: r.id,
      description: r.description,
      itemId: r.itemId,
      quantity: Number(r.quantity),
      unitPrice,
      unitCost,
      amount,
      cogs,
      grossProfit,
      marginPct,
      markupPct,
      toolName: r.toolName,
      toolCategory: r.toolCategory,
      status: r.status,
    };
  });

  // Invoice-level totals
  const totalRevenue = lineItems.reduce((s, l) => s + l.amount, 0);
  const totalCogs = lineItems.reduce((s, l) => s + l.cogs, 0);
  const grossProfit = totalRevenue - totalCogs;
  const marginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;
  const markupPct = totalCogs > 0 ? Number(((grossProfit / totalCogs) * 100).toFixed(1)) : (totalRevenue > 0 ? 100 : 0);

  return {
    invoiceNumber: rows[0].invoiceNumber,
    clientId: rows[0].clientId,
    clientName: rows[0].clientName ?? "Unknown",
    type: rows[0].type,
    invoiceDate: rows[0].transactionDate,
    lineItems,
    summary: {
      lineItemCount: lineItems.length,
      totalQuantity: lineItems.reduce((s, l) => s + l.quantity, 0),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCogs: Number(totalCogs.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      marginPct,
      markupPct,
    },
  };
}

/**
 * Per-client financial totals computed entirely from local DB (transactions + clients.outstandingBalance).
 * Replaces the Manager.io-dependent `financial.allClientTotals` endpoint.
 */
export async function getLocalClientTotals() {
  const db = await requireDb();
  const res = await db.execute(sql`
    SELECT
      c.id AS clientId,
      COALESCE(SUM(t.amount), 0) AS grossBilled,
      COALESCE(SUM(t.cogs), 0) AS totalCogs,
      COALESCE(c.outstandingBalance, 0) AS outstanding,
      COUNT(DISTINCT t.invoiceNumber) AS invoiceCount,
      COUNT(t.id) AS lineItemCount
    FROM clients c
    LEFT JOIN transactions t ON t.clientId = c.id
    GROUP BY c.id
  `);
  const rows = ((res as any).rows ?? res) as Array<{
    clientId: number;
    grossBilled: string | number;
    totalCogs: string | number;
    outstanding: string | number;
    invoiceCount: number;
    lineItemCount: number;
  }>;
  return rows.map((r) => {
    const grossBilled = Number(r.grossBilled);
    const outstanding = Number(r.outstanding);
    const paid = Math.max(grossBilled - outstanding, 0);
    return {
      clientId: r.clientId,
      grossBilled,
      netBilled: grossBilled, // no VAT split in local data
      vatBilled: 0,
      paid,
      outstanding,
      invoiceCount: Number(r.invoiceCount),
    };
  });
}
