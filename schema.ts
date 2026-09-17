import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients — companies that Videa Master Pro Tools Trading LLC serves.
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  industry: varchar("industry", { length: 128 }),
  activityLevel: mysqlEnum("activityLevel", ["high", "medium", "low", "inactive"]).default("medium").notNull(),
  managerCustomerKey: varchar("managerCustomerKey", { length: 64 }),
  latitude: double("latitude"),
  longitude: double("longitude"),
  geocodeSource: mysqlEnum("geocodeSource", ["google", "manual", "research"]),
  geocodedAt: timestamp("geocodedAt"),
  notes: text("notes"),
  outstandingBalance: decimal("outstandingBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  oldestUnpaidDate: timestamp("oldestUnpaidDate"),
  excelClientId: int("excelClientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxName: index("idx_client_name").on(t.companyName),
  idxIndustry: index("idx_client_industry").on(t.industry),
}));

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Machines — equipment owned by clients.
 */
export const machines = mysqlTable("machines", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  machineType: varchar("machineType", { length: 128 }).notNull(),
  brand: varchar("brand", { length: 128 }),
  model: varchar("model", { length: 128 }),
  serialNumber: varchar("serialNumber", { length: 128 }),
  specifications: text("specifications"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxClient: index("idx_machine_client").on(t.clientId),
}));

export type Machine = typeof machines.$inferSelect;
export type InsertMachine = typeof machines.$inferInsert;

/**
 * Tools — catalog of cutting tools offered.
 */
export const tools = mysqlTable("tools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 128 }),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxName: index("idx_tool_name").on(t.name),
}));

export type Tool = typeof tools.$inferSelect;
export type InsertTool = typeof tools.$inferInsert;

/**
 * ClientTools — join table: which tools a client uses + usage notes.
 */
export const clientTools = mysqlTable("clientTools", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  toolId: int("toolId").notNull(),
  machineId: int("machineId"),
  usageFrequency: mysqlEnum("usageFrequency", ["daily", "weekly", "monthly", "occasional"]).default("monthly").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  idxClient: index("idx_ct_client").on(t.clientId),
  idxTool: index("idx_ct_tool").on(t.toolId),
}));

export type ClientTool = typeof clientTools.$inferSelect;
export type InsertClientTool = typeof clientTools.$inferInsert;

/**
 * Transactions — purchases & sharpening orders.
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  toolId: int("toolId"),
  /** Fact_Sales column H — source-of-truth Item_ID from the workbook (e.g. "18016008 MAR180444536CON"). */
  itemId: varchar("itemId", { length: 128 }),
  type: mysqlEnum("type", ["purchase", "sharpening"]).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  cogs: decimal("cogs", { precision: 12, scale: 2 }).default("0").notNull(),
  status: mysqlEnum("status", ["paid", "pending", "overdue"]).default("pending").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }),
  transactionDate: timestamp("transactionDate").defaultNow().notNull(),
  dueDate: timestamp("dueDate"),
  agingBucket: mysqlEnum("agingBucket", ["not_due", "0_30", "31_60", "61_90", "90_plus"]),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idxClient: index("idx_tx_client").on(t.clientId),
  idxDate: index("idx_tx_date").on(t.transactionDate),
  idxStatus: index("idx_tx_status").on(t.status),
  idxItemId: index("idx_tx_item_id").on(t.itemId),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Portfolio cache — stores the last successful Manager.io portfolio totals
 * so the Dashboard can show stale data when Manager.io is unreachable.
 */
export const portfolioCache = mysqlTable("portfolioCache", {
  id: int("id").autoincrement().primaryKey(),
  billed: decimal("billed", { precision: 14, scale: 2 }).notNull().default("0"),
  paid: decimal("paid", { precision: 14, scale: 2 }).notNull().default("0"),
  outstanding: decimal("outstanding", { precision: 14, scale: 2 }).notNull().default("0"),
  thisMonth: decimal("thisMonth", { precision: 14, scale: 2 }).notNull().default("0"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

export type PortfolioCache = typeof portfolioCache.$inferSelect;
export type InsertPortfolioCache = typeof portfolioCache.$inferInsert;

/**
 * API Configuration — stores user-managed credentials for external services.
 * Allows users to update API keys directly in the app without needing
 * to contact support or restart the server.
 */
export const apiConfig = mysqlTable("apiConfig", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiConfig = typeof apiConfig.$inferSelect;
export type InsertApiConfig = typeof apiConfig.$inferInsert;

/**
 * Operating Costs — sourced from the Fact_Cost sheet of the master workbook.
 *
 * Every Fact_Cost row whose cost_type is NOT "Inventory Purchase" (and not
 * shipping, which the workbook bundles into Inventory Purchase) is imported
 * here. Rows are tagged with a normalized `category` so that operating costs
 * can be summarized monthly and a true Net Profit (Gross Profit − Operating
 * Cost) can be reported on the Dashboard.
 *
 * `excelCostId` and `excelKey` together identify the row in the workbook so
 * re-syncs do not duplicate.
 */
export const operatingCosts = mysqlTable(
  "operatingCosts",
  {
    id: int("id").autoincrement().primaryKey(),
    excelCostId: varchar("excelCostId", { length: 64 }),
    excelKey: varchar("excelKey", { length: 320 }),
    txDate: timestamp("txDate").notNull(),
    payee: varchar("payee", { length: 320 }),
    expenseAccount: varchar("expenseAccount", { length: 320 }),
    description: text("description"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("AED").notNull(),
    paidFrom: varchar("paidFrom", { length: 128 }),
    reference: varchar("reference", { length: 128 }),
    rawCostType: varchar("rawCostType", { length: 128 }),
    costCenter: varchar("costCenter", { length: 128 }),
    // Normalized classification: which expense bucket this cost belongs to.
    category: mysqlEnum("category", [
      "salaries",
      "rent",
      "fuel",
      "maintenance",
      "utilities",
      "phone_internet",
      "office",
      "it_equipment",
      "marketing",
      "legal",
      "accounting",
      "bank_fees",
      "tax",
      "other_operating",
    ]).notNull(),
    // Top-level grouping so the Dashboard knows what to subtract from gross.
    classification: mysqlEnum("classification", [
      "operating",
      "inventory",
      "shipping",
      "other",
    ]).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxDate: index("idx_op_cost_date").on(t.txDate),
    idxCategory: index("idx_op_cost_category").on(t.category),
    idxClassification: index("idx_op_cost_classification").on(t.classification),
    idxExcelKey: index("idx_op_cost_excel_key").on(t.excelKey),
  })
);

export type OperatingCost = typeof operatingCosts.$inferSelect;
export type InsertOperatingCost = typeof operatingCosts.$inferInsert;

/**
 * Sync State — single-row table that records the SHA256 of the last successfully
 * imported Dashboard workbook so we can skip a re-import when the same bytes
 * are uploaded again. This makes the auto-sync-on-refresh flow effectively free
 * when the workbook hasn't changed.
 */
export const syncState = mysqlTable("syncState", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable key, currently always "dashboard". Lets us add other sync sources later. */
  source: varchar("source", { length: 64 }).notNull().unique(),
  /** Hex SHA256 of the workbook bytes. */
  fileHash: varchar("fileHash", { length: 128 }).notNull(),
  /** File name as uploaded, for display. */
  fileName: varchar("fileName", { length: 320 }),
  /** Cached summary JSON of the last successful import. */
  summaryJson: text("summaryJson"),
  /** When the import that produced this summary completed. */
  lastSyncAt: timestamp("lastSyncAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = typeof syncState.$inferInsert;
